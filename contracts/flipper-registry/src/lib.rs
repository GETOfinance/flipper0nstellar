#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, symbol_short, token};

#[contracttype]
#[derive(Clone)]
pub enum AgentStatus {
    Active,
    Paused,
    Decommissioned,
}

#[contracttype]
#[derive(Clone)]
pub enum AgentTier {
    Scout,
    Guardian,
    Sentinel,
    Archon,
}

#[contracttype]
#[derive(Clone)]
pub struct AgentInfo {
    pub name: String,
    pub agent_uri: String,
    pub operator: Address,
    pub registered_at: u64,
    pub total_decisions: u64,
    pub successful_actions: u64,
    pub total_value_protected: i128,
    pub status: AgentStatus,
    pub tier: AgentTier,
}

#[contracttype]
#[derive(Clone)]
pub struct ReputationEntry {
    pub reviewer: Address,
    pub score: u32,
    pub comment: String,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    NextTokenId,
    Agents(u64),
    OperatorToAgent(Address),
    HasAgent(Address),
    AuthorizedVaults(Address),
    ReputationLog(u64),
    RegistrationFee,
    MaxAgents,
    Owner,
}

fn get_owner(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Owner).unwrap()
}

fn set_owner(env: &Env, owner: &Address) {
    env.storage().instance().set(&DataKey::Owner, owner);
}

fn get_next_token_id(env: &Env) -> u64 {
    env.storage().instance().get(&DataKey::NextTokenId).unwrap_or(0)
}

fn set_next_token_id(env: &Env, id: u64) {
    env.storage().instance().set(&DataKey::NextTokenId, &id);
}

#[contract]
pub struct FlipperRegistry;

#[contractimpl]
impl FlipperRegistry {
    pub fn __constructor(env: Env, registration_fee: i128, max_agents: u64, owner: Address) {
        set_owner(&env, &owner);
        env.storage().instance().set(&DataKey::RegistrationFee, &registration_fee);
        env.storage().instance().set(&DataKey::MaxAgents, &max_agents);
        set_next_token_id(&env, 0);
    }

    pub fn register_agent(
        env: Env,
        operator: Address,
        name: String,
        agent_uri: String,
        tier: AgentTier,
    ) -> u64 {
        operator.require_auth();

        let fee: i128 = env.storage().instance().get(&DataKey::RegistrationFee).unwrap_or(0);
        let max_agents: u64 = env.storage().instance().get(&DataKey::MaxAgents).unwrap_or(100);
        let has_agent: bool = env.storage().instance()
            .get(&DataKey::HasAgent(operator.clone()))
            .unwrap_or(false);

        let next_id = get_next_token_id(&env);

        assert!(!has_agent, "Operator already has an agent");
        assert!(next_id < max_agents, "Max agents reached");
        assert!(name.len() > 0 && name.len() <= 64, "Invalid name length");

        if fee > 0 {
            let native = token::Client::new(&env, &env.storage().instance()
                .get(&symbol_short!("native"))
                .unwrap());
            native.transfer(&operator, &get_owner(&env), &fee);
        }

        let agent = AgentInfo {
            name,
            agent_uri,
            operator: operator.clone(),
            registered_at: env.ledger().timestamp(),
            total_decisions: 0,
            successful_actions: 0,
            total_value_protected: 0,
            status: AgentStatus::Active,
            tier,
        };

        env.storage().instance().set(&DataKey::Agents(next_id), &agent);
        env.storage().instance().set(&DataKey::OperatorToAgent(operator.clone()), &next_id);
        env.storage().instance().set(&DataKey::HasAgent(operator), &true);
        set_next_token_id(&env, next_id + 1);

        env.events().publish(
            (symbol_short!("RegAgnt"), next_id),
            agent.operator.clone(),
        );

        next_id
    }

    pub fn update_agent_uri(env: Env, agent_id: u64, new_uri: String) {
        let mut agent: AgentInfo = env.storage().instance()
            .get(&DataKey::Agents(agent_id))
            .unwrap();
        agent.operator.require_auth();
        agent.agent_uri = new_uri;
        env.storage().instance().set(&DataKey::Agents(agent_id), &agent);

        env.events().publish(
            (symbol_short!("URIUpd"), agent_id),
            agent.agent_uri.clone(),
        );
    }

    pub fn set_agent_status(env: Env, agent_id: u64, new_status: AgentStatus) {
        let mut agent: AgentInfo = env.storage().instance()
            .get(&DataKey::Agents(agent_id))
            .unwrap();
        agent.operator.require_auth();

        match &agent.status {
            AgentStatus::Decommissioned => panic!("Agent decommissioned"),
            _ => {}
        }

        agent.status = new_status;
        env.storage().instance().set(&DataKey::Agents(agent_id), &agent);

        env.events().publish(
            (symbol_short!("StatChg"), agent_id),
            agent.status.clone(),
        );
    }

    pub fn upgrade_agent_tier(env: Env, agent_id: u64, new_tier: AgentTier) {
        let owner = get_owner(&env);
        owner.require_auth();

        let mut agent: AgentInfo = env.storage().instance()
            .get(&DataKey::Agents(agent_id))
            .unwrap();

        let old_tier = &agent.tier;
        let can_upgrade = match (old_tier, &new_tier) {
            (AgentTier::Scout, AgentTier::Guardian) => true,
            (AgentTier::Guardian, AgentTier::Sentinel) => true,
            (AgentTier::Sentinel, AgentTier::Archon) => true,
            _ => false,
        };
        assert!(can_upgrade, "Can only upgrade tier");

        agent.tier = new_tier;
        env.storage().instance().set(&DataKey::Agents(agent_id), &agent);

        env.events().publish(
            (symbol_short!("TierUp"), agent_id),
            agent.tier.clone(),
        );
    }

    pub fn record_agent_action(
        env: Env,
        agent_id: u64,
        was_successful: bool,
        value_protected: i128,
    ) {
        let caller = env.current_contract_address();
        let authorized: bool = env.storage().instance()
            .get(&DataKey::AuthorizedVaults(caller.clone()))
            .unwrap_or(false);
        assert!(authorized, "Not authorized vault");

        let mut agent: AgentInfo = env.storage().instance()
            .get(&DataKey::Agents(agent_id))
            .unwrap();

        agent.total_decisions += 1;
        if was_successful {
            agent.successful_actions += 1;
            agent.total_value_protected += value_protected;
        }
        env.storage().instance().set(&DataKey::Agents(agent_id), &agent);

        env.events().publish(
            (symbol_short!("StatUpd"), agent_id),
            (agent.total_decisions, agent.successful_actions, agent.total_value_protected),
        );
    }

    pub fn give_feedback(
        env: Env,
        agent_id: u64,
        reviewer: Address,
        score: u32,
        comment: String,
    ) {
        reviewer.require_auth();
        assert!(score >= 1 && score <= 5, "Score must be 1-5");

        let agent: AgentInfo = env.storage().instance()
            .get(&DataKey::Agents(agent_id))
            .unwrap();
        assert!(agent.operator != reviewer, "Cannot review own agent");

        let entry = ReputationEntry {
            reviewer,
            score,
            comment,
            timestamp: env.ledger().timestamp(),
        };

        let mut log: Vec<ReputationEntry> = env.storage().instance()
            .get(&DataKey::ReputationLog(agent_id))
            .unwrap_or(Vec::new(&env));
        log.push_back(entry);
        env.storage().instance().set(&DataKey::ReputationLog(agent_id), &log);

        env.events().publish(
            (symbol_short!("RepFeed"), agent_id),
            score,
        );
    }

    pub fn get_agent(env: Env, agent_id: u64) -> AgentInfo {
        env.storage().instance().get(&DataKey::Agents(agent_id)).unwrap()
    }

    pub fn get_reputation_score(env: Env, agent_id: u64) -> u64 {
        let log: Vec<ReputationEntry> = env.storage().instance()
            .get(&DataKey::ReputationLog(agent_id))
            .unwrap_or(Vec::new(&env));
        if log.is_empty() {
            return 0;
        }
        let mut total: u64 = 0;
        for i in 0..log.len() {
            total += log.get(i).unwrap().score as u64;
        }
        (total * 100) / (log.len() as u64)
    }

    pub fn get_success_rate(env: Env, agent_id: u64) -> u64 {
        let agent: AgentInfo = env.storage().instance()
            .get(&DataKey::Agents(agent_id))
            .unwrap();
        if agent.total_decisions == 0 {
            return 0;
        }
        (agent.successful_actions as u64 * 10000) / (agent.total_decisions as u64)
    }

    pub fn get_agent_count(env: Env) -> u64 {
        get_next_token_id(&env)
    }

    pub fn is_agent_active(env: Env, agent_id: u64) -> bool {
        let agent: AgentInfo = env.storage().instance()
            .get(&DataKey::Agents(agent_id))
            .unwrap();
        matches!(agent.status, AgentStatus::Active)
    }

    pub fn set_vault_authorization(env: Env, vault: Address, authorized: bool) {
        let owner = get_owner(&env);
        owner.require_auth();
        env.storage().instance().set(&DataKey::AuthorizedVaults(vault.clone()), &authorized);
        env.events().publish(
            (symbol_short!("VltAuth"), vault),
            authorized,
        );
    }

    pub fn set_registration_fee(env: Env, new_fee: i128) {
        let owner = get_owner(&env);
        owner.require_auth();
        env.storage().instance().set(&DataKey::RegistrationFee, &new_fee);
    }
}
