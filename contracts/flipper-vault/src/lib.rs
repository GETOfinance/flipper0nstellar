#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec, symbol_short, token};

#[contracttype]
#[derive(Clone)]
pub enum ActionType {
    EmergencyWithdraw,
    Rebalance,
    AlertOnly,
    StopLoss,
    TakeProfit,
}

#[contracttype]
#[derive(Clone)]
pub struct RiskProfile {
    pub max_slippage: u64,
    pub stop_loss_threshold: u64,
    pub max_single_action_value: i128,
    pub allow_auto_withdraw: bool,
    pub allow_auto_swap: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Position {
    pub xlm_balance: i128,
    pub deposit_timestamp: u64,
    pub last_action_timestamp: u64,
    pub is_active: bool,
    pub authorized_agent_id: u64,
    pub agent_authorized: bool,
    pub risk_profile: RiskProfile,
}

#[contracttype]
#[derive(Clone)]
pub struct ProtectionAction {
    pub agent_id: u64,
    pub user: Address,
    pub action_type: ActionType,
    pub value: i128,
    pub timestamp: u64,
    pub reason_hash: BytesN<32>,
    pub successful: bool,
}

use soroban_sdk::BytesN;

#[contracttype]
pub enum DataKey {
    Positions(Address),
    TokenBalances(Address, Address),
    UserTokens(Address),
    ActionHistory,
    UserActions(Address),
    AgentActions(u64),
    RegistryAddress,
    TotalXlmDeposited,
    TotalActionsExecuted,
    TotalValueProtected,
    ProtocolFeeBps,
    MinDeposit,
    DepositsPaused,
    AuthorizedOperators(Address),
    Owner,
    NativeToken,
}

fn get_owner(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Owner).unwrap()
}

fn get_native(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::NativeToken).unwrap()
}

#[contract]
pub struct FlipperVault;

#[contractimpl]
impl FlipperVault {
    pub fn __constructor(
        env: Env,
        registry_address: Address,
        protocol_fee_bps: u64,
        min_deposit: i128,
        native_token: Address,
        owner: Address,
    ) {
        assert!(protocol_fee_bps <= 500, "Fee too high");
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::RegistryAddress, &registry_address);
        env.storage().instance().set(&DataKey::ProtocolFeeBps, &protocol_fee_bps);
        env.storage().instance().set(&DataKey::MinDeposit, &min_deposit);
        env.storage().instance().set(&DataKey::DepositsPaused, &false);
        env.storage().instance().set(&DataKey::TotalXlmDeposited, &0i128);
        env.storage().instance().set(&DataKey::TotalActionsExecuted, &0u64);
        env.storage().instance().set(&DataKey::TotalValueProtected, &0i128);
        env.storage().instance().set(&DataKey::NativeToken, &native_token);
    }

    pub fn deposit(env: Env, user: Address, amount: i128) {
        user.require_auth();

        let paused: bool = env.storage().instance().get(&DataKey::DepositsPaused).unwrap_or(false);
        assert!(!paused, "Deposits paused");
        let min_deposit: i128 = env.storage().instance().get(&DataKey::MinDeposit).unwrap_or(0);
        assert!(amount >= min_deposit, "Below minimum deposit");

        let native = token::Client::new(&env, &get_native(&env));
        native.transfer(&user, &env.current_contract_address(), &amount);

        let key = DataKey::Positions(user.clone());
        let mut pos: Position = env.storage().instance().get(&key).unwrap_or(Position {
            xlm_balance: 0,
            deposit_timestamp: env.ledger().timestamp(),
            last_action_timestamp: 0,
            is_active: false,
            authorized_agent_id: 0,
            agent_authorized: false,
            risk_profile: RiskProfile {
                max_slippage: 100,
                stop_loss_threshold: 1000,
                max_single_action_value: amount / 2,
                allow_auto_withdraw: true,
                allow_auto_swap: false,
            },
        });

        if !pos.is_active {
            pos.deposit_timestamp = env.ledger().timestamp();
            pos.is_active = true;
        }
        pos.xlm_balance += amount;

        let mut total: i128 = env.storage().instance().get(&DataKey::TotalXlmDeposited).unwrap_or(0);
        total += amount;
        env.storage().instance().set(&DataKey::TotalXlmDeposited, &total);
        env.storage().instance().set(&key, &pos);

        env.events().publish((symbol_short!("Deposit"), user.clone()), amount);
    }

    pub fn deposit_token(env: Env, user: Address, token_addr: Address, amount: i128) {
        user.require_auth();
        assert!(amount > 0, "Amount must be > 0");

        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        let key = DataKey::Positions(user.clone());
        let mut pos: Position = env.storage().instance().get(&key).unwrap_or(Position {
            xlm_balance: 0,
            deposit_timestamp: env.ledger().timestamp(),
            last_action_timestamp: 0,
            is_active: false,
            authorized_agent_id: 0,
            agent_authorized: false,
            risk_profile: RiskProfile {
                max_slippage: 100,
                stop_loss_threshold: 1000,
                max_single_action_value: i128::MAX,
                allow_auto_withdraw: true,
                allow_auto_swap: false,
            },
        });

        if !pos.is_active {
            pos.deposit_timestamp = env.ledger().timestamp();
            pos.is_active = true;
        }

        let bal_key = DataKey::TokenBalances(user.clone(), token_addr.clone());
        let prev: i128 = env.storage().instance().get(&bal_key).unwrap_or(0);
        if prev == 0 {
            let mut tokens: Vec<Address> = env.storage().instance()
                .get(&DataKey::UserTokens(user.clone()))
                .unwrap_or(Vec::new(&env));
            tokens.push_back(token_addr.clone());
            env.storage().instance().set(&DataKey::UserTokens(user.clone()), &tokens);
        }
        env.storage().instance().set(&bal_key, &(prev + amount));
        env.storage().instance().set(&key, &pos);

        env.events().publish((symbol_short!("TokDep"), user.clone()), amount);
    }

    pub fn withdraw(env: Env, user: Address, amount: i128) {
        user.require_auth();

        let key = DataKey::Positions(user.clone());
        let mut pos: Position = env.storage().instance().get(&key).unwrap();
        assert!(pos.is_active, "No active position");

        let withdraw_amount = if amount == 0 { pos.xlm_balance } else { amount };
        assert!(withdraw_amount <= pos.xlm_balance, "Insufficient balance");

        pos.xlm_balance -= withdraw_amount;
        let mut total: i128 = env.storage().instance().get(&DataKey::TotalXlmDeposited).unwrap_or(0);
        total -= withdraw_amount;
        env.storage().instance().set(&DataKey::TotalXlmDeposited, &total);

        let native = token::Client::new(&env, &get_native(&env));
        native.transfer(&env.current_contract_address(), &user, &withdraw_amount);

        env.storage().instance().set(&key, &pos);
        env.events().publish((symbol_short!("Withdrw"), user.clone()), withdraw_amount);
    }

    pub fn withdraw_token(env: Env, user: Address, token_addr: Address, amount: i128) {
        user.require_auth();

        let bal_key = DataKey::TokenBalances(user.clone(), token_addr.clone());
        let balance: i128 = env.storage().instance().get(&bal_key).unwrap_or(0);
        let withdraw_amount = if amount == 0 { balance } else { amount };
        assert!(withdraw_amount <= balance, "Insufficient token balance");

        env.storage().instance().set(&bal_key, &(balance - withdraw_amount));

        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &user, &withdraw_amount);

        env.events().publish((symbol_short!("TokWdr"), user.clone()), withdraw_amount);
    }

    pub fn authorize_agent(env: Env, user: Address, agent_id: u64) {
        user.require_auth();
        let key = DataKey::Positions(user.clone());
        let mut pos: Position = env.storage().instance().get(&key).unwrap();
        assert!(pos.is_active, "No active position");

        pos.authorized_agent_id = agent_id;
        pos.agent_authorized = true;
        env.storage().instance().set(&key, &pos);

        env.events().publish((symbol_short!("AgAuth"), user.clone()), agent_id);
    }

    pub fn revoke_agent(env: Env, user: Address) {
        user.require_auth();
        let key = DataKey::Positions(user.clone());
        let mut pos: Position = env.storage().instance().get(&key).unwrap();

        let old_agent_id = pos.authorized_agent_id;
        pos.agent_authorized = false;
        pos.authorized_agent_id = 0;
        env.storage().instance().set(&key, &pos);

        env.events().publish((symbol_short!("AgRevk"), user.clone()), old_agent_id);
    }

    pub fn update_risk_profile(
        env: Env,
        user: Address,
        max_slippage: u64,
        stop_loss_threshold: u64,
        max_single_action_value: i128,
        allow_auto_withdraw: bool,
        allow_auto_swap: bool,
    ) {
        user.require_auth();
        assert!(max_slippage <= 1000, "Slippage too high");
        assert!(stop_loss_threshold <= 5000, "Stop loss too high");

        let key = DataKey::Positions(user.clone());
        let mut pos: Position = env.storage().instance().get(&key).unwrap();
        assert!(pos.is_active, "No active position");

        pos.risk_profile = RiskProfile {
            max_slippage,
            stop_loss_threshold,
            max_single_action_value,
            allow_auto_withdraw,
            allow_auto_swap,
        };
        env.storage().instance().set(&key, &pos);

        env.events().publish((symbol_short!("RiskUpd"), user.clone()), max_slippage);
    }

    pub fn emergency_withdraw(env: Env, user: Address) {
        user.require_auth();
        let key = DataKey::Positions(user.clone());
        let mut pos: Position = env.storage().instance().get(&key).unwrap();

        let xlm_amount = pos.xlm_balance;
        pos.xlm_balance = 0;
        pos.is_active = false;
        pos.agent_authorized = false;

        let mut total: i128 = env.storage().instance().get(&DataKey::TotalXlmDeposited).unwrap_or(0);
        total -= xlm_amount;
        env.storage().instance().set(&DataKey::TotalXlmDeposited, &total);
        env.storage().instance().set(&key, &pos);

        if xlm_amount > 0 {
            let native = token::Client::new(&env, &get_native(&env));
            native.transfer(&env.current_contract_address(), &user, &xlm_amount);
        }

        env.events().publish((symbol_short!("EmrgWd"), user.clone()), xlm_amount);
    }

    pub fn execute_protection(
        env: Env,
        caller: Address,
        user: Address,
        action_type: ActionType,
        value: i128,
        reason_hash: BytesN<32>,
    ) -> u64 {
        caller.require_auth();

        let authorized: bool = env.storage().instance()
            .get(&DataKey::AuthorizedOperators(caller.clone()))
            .unwrap_or(false);
        assert!(authorized, "Not authorized operator");

        let key = DataKey::Positions(user.clone());
        let mut pos: Position = env.storage().instance().get(&key).unwrap();
        assert!(pos.is_active, "Position not active");
        assert!(pos.agent_authorized, "No agent authorized");

        match &action_type {
            ActionType::EmergencyWithdraw => {
                assert!(pos.risk_profile.allow_auto_withdraw, "Auto-withdraw not allowed");
            }
            ActionType::StopLoss => {
                assert!(pos.risk_profile.allow_auto_withdraw, "Auto-withdraw not allowed");
            }
            _ => {}
        }

        if value > 0 {
            assert!(value <= pos.risk_profile.max_single_action_value, "Exceeds max action value");
        }

        let mut successful = true;
        let agent_id = pos.authorized_agent_id;

        match &action_type {
            ActionType::EmergencyWithdraw | ActionType::StopLoss => {
                if value > 0 && value <= pos.xlm_balance {
                    pos.xlm_balance -= value;
                    let mut total: i128 = env.storage().instance().get(&DataKey::TotalXlmDeposited).unwrap_or(0);
                    total -= value;
                    env.storage().instance().set(&DataKey::TotalXlmDeposited, &total);

                    let native = token::Client::new(&env, &get_native(&env));
                    native.transfer(&env.current_contract_address(), &user, &value);
                } else if value > pos.xlm_balance {
                    successful = false;
                }
            }
            _ => {}
        }

        pos.last_action_timestamp = env.ledger().timestamp();
        env.storage().instance().set(&key, &pos);

        let action = ProtectionAction {
            agent_id,
            user: user.clone(),
            action_type,
            value,
            timestamp: env.ledger().timestamp(),
            reason_hash,
            successful,
        };

        let mut history: Vec<ProtectionAction> = env.storage().instance()
            .get(&DataKey::ActionHistory)
            .unwrap_or(Vec::new(&env));
        let action_id = history.len() as u64;
        history.push_back(action);
        env.storage().instance().set(&DataKey::ActionHistory, &history);

        let mut user_actions: Vec<u64> = env.storage().instance()
            .get(&DataKey::UserActions(user.clone()))
            .unwrap_or(Vec::new(&env));
        user_actions.push_back(action_id);
        env.storage().instance().set(&DataKey::UserActions(user.clone()), &user_actions);

        let mut agent_actions: Vec<u64> = env.storage().instance()
            .get(&DataKey::AgentActions(agent_id))
            .unwrap_or(Vec::new(&env));
        agent_actions.push_back(action_id);
        env.storage().instance().set(&DataKey::AgentActions(agent_id), &agent_actions);

        let mut total_exec: u64 = env.storage().instance().get(&DataKey::TotalActionsExecuted).unwrap_or(0);
        total_exec += 1;
        env.storage().instance().set(&DataKey::TotalActionsExecuted, &total_exec);

        if successful && value > 0 {
            let mut total_val: i128 = env.storage().instance().get(&DataKey::TotalValueProtected).unwrap_or(0);
            total_val += value;
            env.storage().instance().set(&DataKey::TotalValueProtected, &total_val);
        }

        env.events().publish(
            (symbol_short!("ProtExec"), action_id),
            (agent_id, successful),
        );

        action_id
    }

    pub fn get_position(env: Env, user: Address) -> Position {
        env.storage().instance().get(&DataKey::Positions(user)).unwrap()
    }

    pub fn get_risk_profile(env: Env, user: Address) -> RiskProfile {
        let pos: Position = env.storage().instance().get(&DataKey::Positions(user)).unwrap();
        pos.risk_profile
    }

    pub fn get_token_balance(env: Env, user: Address, token_addr: Address) -> i128 {
        env.storage().instance().get(&DataKey::TokenBalances(user, token_addr)).unwrap_or(0)
    }

    pub fn get_vault_stats(env: Env) -> (i128, u64, i128) {
        let total_xlm: i128 = env.storage().instance().get(&DataKey::TotalXlmDeposited).unwrap_or(0);
        let total_actions: u64 = env.storage().instance().get(&DataKey::TotalActionsExecuted).unwrap_or(0);
        let total_protected: i128 = env.storage().instance().get(&DataKey::TotalValueProtected).unwrap_or(0);
        (total_xlm, total_actions, total_protected)
    }

    pub fn set_operator_authorization(env: Env, operator: Address, authorized: bool) {
        let owner = get_owner(&env);
        owner.require_auth();
        env.storage().instance().set(&DataKey::AuthorizedOperators(operator), &authorized);
    }

    pub fn set_deposits_paused(env: Env, paused: bool) {
        let owner = get_owner(&env);
        owner.require_auth();
        env.storage().instance().set(&DataKey::DepositsPaused, &paused);
    }
}
