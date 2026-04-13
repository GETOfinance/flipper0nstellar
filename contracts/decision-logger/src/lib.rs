#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec, symbol_short};

#[contracttype]
#[derive(Clone)]
pub enum DecisionType {
    RiskAssessment,
    ThreatDetected,
    ProtectionTriggered,
    AllClear,
    MarketAnalysis,
    PositionReview,
}

#[contracttype]
#[derive(Clone)]
pub enum RiskLevel {
    None,
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone)]
pub struct Decision {
    pub agent_id: u64,
    pub target_user: Address,
    pub decision_type: DecisionType,
    pub risk_level: RiskLevel,
    pub confidence: u64,
    pub analysis_hash: BytesN<32>,
    pub data_hash: BytesN<32>,
    pub timestamp: u64,
    pub action_taken: bool,
    pub action_id: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct RiskSnapshot {
    pub timestamp: u64,
    pub overall_risk: RiskLevel,
    pub liquidation_risk: u64,
    pub volatility_score: u64,
    pub protocol_risk: u64,
    pub smart_contract_risk: u64,
    pub details_hash: BytesN<32>,
}

#[contracttype]
pub enum DataKey {
    Decisions,
    AgentDecisions(u64),
    UserDecisions(Address),
    LatestRiskSnapshot(Address),
    RiskHistory(Address),
    AuthorizedLoggers(Address),
    TotalThreatsDetected,
    TotalProtectionsTriggered,
    Owner,
}

fn get_owner(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Owner).unwrap()
}

#[contract]
pub struct DecisionLogger;

#[contractimpl]
impl DecisionLogger {
    pub fn __constructor(env: Env, owner: Address) {
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::TotalThreatsDetected, &0u64);
        env.storage().instance().set(&DataKey::TotalProtectionsTriggered, &0u64);
    }

    pub fn log_decision(
        env: Env,
        caller: Address,
        agent_id: u64,
        target_user: Address,
        decision_type: DecisionType,
        risk_level: RiskLevel,
        confidence: u64,
        analysis_hash: BytesN<32>,
        data_hash: BytesN<32>,
        action_taken: bool,
        action_id: u64,
    ) -> u64 {
        caller.require_auth();

        let authorized: bool = env.storage().instance()
            .get(&DataKey::AuthorizedLoggers(caller.clone()))
            .unwrap_or(false);
        assert!(authorized, "Not authorized logger");
        assert!(confidence <= 10000, "Confidence out of range");

        let decision = Decision {
            agent_id,
            target_user: target_user.clone(),
            decision_type: decision_type.clone(),
            risk_level: risk_level.clone(),
            confidence,
            analysis_hash,
            data_hash,
            timestamp: env.ledger().timestamp(),
            action_taken,
            action_id,
        };

        let mut decisions: Vec<Decision> = env.storage().instance()
            .get(&DataKey::Decisions)
            .unwrap_or(Vec::new(&env));
        let decision_id = decisions.len() as u64;
        decisions.push_back(decision);
        env.storage().instance().set(&DataKey::Decisions, &decisions);

        let mut agent_decs: Vec<u64> = env.storage().instance()
            .get(&DataKey::AgentDecisions(agent_id))
            .unwrap_or(Vec::new(&env));
        agent_decs.push_back(decision_id);
        env.storage().instance().set(&DataKey::AgentDecisions(agent_id), &agent_decs);

        let mut user_decs: Vec<u64> = env.storage().instance()
            .get(&DataKey::UserDecisions(target_user.clone()))
            .unwrap_or(Vec::new(&env));
        user_decs.push_back(decision_id);
        env.storage().instance().set(&DataKey::UserDecisions(target_user.clone()), &user_decs);

        let mut total_threats: u64 = env.storage().instance().get(&DataKey::TotalThreatsDetected).unwrap_or(0);
        let mut total_protections: u64 = env.storage().instance().get(&DataKey::TotalProtectionsTriggered).unwrap_or(0);

        match decision_type {
            DecisionType::ThreatDetected => {
                total_threats += 1;
                env.storage().instance().set(&DataKey::TotalThreatsDetected, &total_threats);
                env.events().publish(
                    (symbol_short!("Threat"), decision_id),
                    agent_id,
                );
            }
            DecisionType::ProtectionTriggered => {
                total_protections += 1;
                env.storage().instance().set(&DataKey::TotalProtectionsTriggered, &total_protections);
            }
            _ => {}
        }

        env.events().publish(
            (symbol_short!("DecLog"), decision_id),
            (agent_id, confidence),
        );

        decision_id
    }

    pub fn update_risk_snapshot(
        env: Env,
        caller: Address,
        user: Address,
        overall_risk: RiskLevel,
        liquidation_risk: u64,
        volatility_score: u64,
        protocol_risk: u64,
        smart_contract_risk: u64,
        details_hash: BytesN<32>,
    ) {
        caller.require_auth();

        let authorized: bool = env.storage().instance()
            .get(&DataKey::AuthorizedLoggers(caller.clone()))
            .unwrap_or(false);
        assert!(authorized, "Not authorized logger");
        assert!(liquidation_risk <= 10000, "Invalid liquidation risk");
        assert!(volatility_score <= 10000, "Invalid volatility score");
        assert!(protocol_risk <= 10000, "Invalid protocol risk");
        assert!(smart_contract_risk <= 10000, "Invalid smart contract risk");

        let snapshot = RiskSnapshot {
            timestamp: env.ledger().timestamp(),
            overall_risk,
            liquidation_risk,
            volatility_score,
            protocol_risk,
            smart_contract_risk,
            details_hash,
        };

        env.storage().instance().set(&DataKey::LatestRiskSnapshot(user.clone()), &snapshot);

        let mut history: Vec<RiskSnapshot> = env.storage().instance()
            .get(&DataKey::RiskHistory(user.clone()))
            .unwrap_or(Vec::new(&env));
        history.push_back(snapshot);
        env.storage().instance().set(&DataKey::RiskHistory(user.clone()), &history);

        env.events().publish(
            (symbol_short!("RiskSnap"), user.clone()),
            env.ledger().timestamp(),
        );
    }

    pub fn get_decision_count(env: Env) -> u64 {
        let decisions: Vec<Decision> = env.storage().instance()
            .get(&DataKey::Decisions)
            .unwrap_or(Vec::new(&env));
        decisions.len() as u64
    }

    pub fn get_decision(env: Env, decision_id: u64) -> Decision {
        let decisions: Vec<Decision> = env.storage().instance()
            .get(&DataKey::Decisions)
            .unwrap_or(Vec::new(&env));
        decisions.get(decision_id.try_into().unwrap()).unwrap()
    }

    pub fn get_agent_decisions(env: Env, agent_id: u64) -> Vec<u64> {
        env.storage().instance().get(&DataKey::AgentDecisions(agent_id)).unwrap_or(Vec::new(&env))
    }

    pub fn get_user_decisions(env: Env, user: Address) -> Vec<u64> {
        env.storage().instance().get(&DataKey::UserDecisions(user)).unwrap_or(Vec::new(&env))
    }

    pub fn get_latest_risk(env: Env, user: Address) -> RiskSnapshot {
        env.storage().instance().get(&DataKey::LatestRiskSnapshot(user)).unwrap()
    }

    pub fn get_stats(env: Env) -> (u64, u64, u64) {
        let decisions: Vec<Decision> = env.storage().instance()
            .get(&DataKey::Decisions)
            .unwrap_or(Vec::new(&env));
        let total_threats: u64 = env.storage().instance().get(&DataKey::TotalThreatsDetected).unwrap_or(0);
        let total_protections: u64 = env.storage().instance().get(&DataKey::TotalProtectionsTriggered).unwrap_or(0);
        (decisions.len() as u64, total_threats, total_protections)
    }

    pub fn set_logger_authorization(env: Env, logger: Address, authorized: bool) {
        let owner = get_owner(&env);
        owner.require_auth();
        env.storage().instance().set(&DataKey::AuthorizedLoggers(logger.clone()), &authorized);
        env.events().publish(
            (symbol_short!("LogAuth"), logger),
            authorized,
        );
    }
}
