#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec, symbol_short, token};

#[contracttype]
#[derive(Clone)]
pub enum PaymentStatus {
    Pending,
    Verified,
    Settled,
    Expired,
    Refunded,
}

#[contracttype]
#[derive(Clone)]
pub struct Payment {
    pub payer: Address,
    pub payee: Address,
    pub amount: i128,
    pub asset_contract: Address,
    pub resource: BytesN<32>,
    pub scheme: BytesN<8>,
    pub network: BytesN<16>,
    pub timestamp: u64,
    pub expiry: u64,
    pub status: PaymentStatus,
    pub tx_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub struct PaymentRequirement {
    pub scheme: BytesN<8>,
    pub network: BytesN<16>,
    pub asset_contract: Address,
    pub amount: i128,
    pub payee: Address,
    pub max_timeout_seconds: u64,
}

#[contracttype]
pub enum DataKey {
    Payments(BytesN<32>),
    PaymentByTxHash(BytesN<32>),
    PayerPayments(Address),
    PayeePayments(Address),
    AuthorizedVerifiers(Address),
    TotalVolume,
    TotalPayments,
    TotalVerified,
    TotalSettled,
    FeeBps,
    FeeRecipient,
    Owner,
    UsdcContract,
}

fn get_owner(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Owner).unwrap()
}

fn get_usdc(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::UsdcContract).unwrap()
}

#[contract]
pub struct X402Payment;

#[contractimpl]
impl X402Payment {
    pub fn __constructor(
        env: Env,
        owner: Address,
        usdc_contract: Address,
        fee_bps: u64,
        fee_recipient: Address,
    ) {
        assert!(fee_bps <= 1000, "Fee too high");
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::UsdcContract, &usdc_contract);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&DataKey::TotalVolume, &0i128);
        env.storage().instance().set(&DataKey::TotalPayments, &0u64);
        env.storage().instance().set(&DataKey::TotalVerified, &0u64);
        env.storage().instance().set(&DataKey::TotalSettled, &0u64);
    }

    pub fn create_payment(
        env: Env,
        payer: Address,
        payee: Address,
        amount: i128,
        resource_hash: BytesN<32>,
        scheme: BytesN<8>,
        network: BytesN<16>,
        tx_hash: BytesN<32>,
        expiry_seconds: u64,
    ) -> BytesN<32> {
        payer.require_auth();

        assert!(amount > 0, "Amount must be positive");

        let usdc = token::Client::new(&env, &get_usdc(&env));
        let payer_balance = usdc.balance(&payer);
        assert!(payer_balance >= amount, "Insufficient USDC balance");

        let payment_id = tx_hash.clone();

        let now = env.ledger().timestamp();
        let payment = Payment {
            payer: payer.clone(),
            payee: payee.clone(),
            amount,
            asset_contract: get_usdc(&env),
            resource: resource_hash,
            scheme,
            network,
            timestamp: now,
            expiry: now + expiry_seconds,
            status: PaymentStatus::Pending,
            tx_hash: tx_hash.clone(),
        };

        env.storage().instance().set(&DataKey::Payments(payment_id.clone()), &payment);
        env.storage().instance().set(&DataKey::PaymentByTxHash(tx_hash), &payment_id.clone());

        let mut payer_payments: Vec<BytesN<32>> = env.storage().instance()
            .get(&DataKey::PayerPayments(payer.clone()))
            .unwrap_or(Vec::new(&env));
        payer_payments.push_back(payment_id.clone());
        env.storage().instance().set(&DataKey::PayerPayments(payer), &payer_payments);

        let mut payee_payments: Vec<BytesN<32>> = env.storage().instance()
            .get(&DataKey::PayeePayments(payee.clone()))
            .unwrap_or(Vec::new(&env));
        payee_payments.push_back(payment_id.clone());
        env.storage().instance().set(&DataKey::PayeePayments(payee), &payee_payments);

        let mut total: u64 = env.storage().instance().get(&DataKey::TotalPayments).unwrap_or(0);
        total += 1;
        env.storage().instance().set(&DataKey::TotalPayments, &total);

        env.events().publish(
            (symbol_short!("PayCrtd"), payment_id.clone()),
            (payment.payer, payment.amount),
        );

        payment_id
    }

    pub fn verify_payment(env: Env, verifier: Address, payment_id: BytesN<32>) {
        let authorized: bool = env.storage().instance()
            .get(&DataKey::AuthorizedVerifiers(verifier.clone()))
            .unwrap_or(false);
        assert!(authorized || verifier == get_owner(&env), "Not authorized verifier");
        verifier.require_auth();

        let mut payment: Payment = env.storage().instance()
            .get(&DataKey::Payments(payment_id.clone()))
            .unwrap();
        assert!(matches!(payment.status, PaymentStatus::Pending), "Payment not pending");

        let now = env.ledger().timestamp();
        assert!(now < payment.expiry, "Payment expired");

        payment.status = PaymentStatus::Verified;
        env.storage().instance().set(&DataKey::Payments(payment_id.clone()), &payment);

        let mut total: u64 = env.storage().instance().get(&DataKey::TotalVerified).unwrap_or(0);
        total += 1;
        env.storage().instance().set(&DataKey::TotalVerified, &total);

        env.events().publish(
            (symbol_short!("PayVrfd"), payment_id),
            (payment.payer, payment.amount),
        );
    }

    pub fn settle_payment(env: Env, payment_id: BytesN<32>) {
        let mut payment: Payment = env.storage().instance()
            .get(&DataKey::Payments(payment_id.clone()))
            .unwrap();
        assert!(matches!(payment.status, PaymentStatus::Verified), "Payment not verified");

        let usdc = token::Client::new(&env, &get_usdc(&env));
        let fee_bps: u64 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);
        let fee_recipient: Address = env.storage().instance().get(&DataKey::FeeRecipient).unwrap();

        let fee_amount = (payment.amount * fee_bps as i128) / 10000;
        let net_amount = payment.amount - fee_amount;

        usdc.transfer(&payment.payer, &payment.payee, &net_amount);

        if fee_amount > 0 {
            usdc.transfer(&payment.payer, &fee_recipient, &fee_amount);
        }

        payment.status = PaymentStatus::Settled;
        env.storage().instance().set(&DataKey::Payments(payment_id.clone()), &payment);

        let mut total_volume: i128 = env.storage().instance().get(&DataKey::TotalVolume).unwrap_or(0);
        total_volume += payment.amount;
        env.storage().instance().set(&DataKey::TotalVolume, &total_volume);

        let mut total: u64 = env.storage().instance().get(&DataKey::TotalSettled).unwrap_or(0);
        total += 1;
        env.storage().instance().set(&DataKey::TotalSettled, &total);

        env.events().publish(
            (symbol_short!("PayStld"), payment_id),
            (payment.payer, payment.amount),
        );
    }

    pub fn expire_payment(env: Env, payment_id: BytesN<32>) {
        let mut payment: Payment = env.storage().instance()
            .get(&DataKey::Payments(payment_id.clone()))
            .unwrap();
        assert!(matches!(payment.status, PaymentStatus::Pending), "Payment not pending");

        let now = env.ledger().timestamp();
        assert!(now >= payment.expiry, "Payment not yet expired");

        payment.status = PaymentStatus::Expired;
        env.storage().instance().set(&DataKey::Payments(payment_id), &payment);

        env.events().publish(
            (symbol_short!("PayExpr"), payment.payer.clone()),
            payment.amount,
        );
    }

    pub fn refund_payment(env: Env, payment_id: BytesN<32>) {
        let owner = get_owner(&env);
        owner.require_auth();

        let mut payment: Payment = env.storage().instance()
            .get(&DataKey::Payments(payment_id.clone()))
            .unwrap();
        assert!(matches!(payment.status, PaymentStatus::Verified | PaymentStatus::Pending), "Payment not refundable");

        payment.status = PaymentStatus::Refunded;
        env.storage().instance().set(&DataKey::Payments(payment_id), &payment);
    }

    pub fn get_payment(env: Env, payment_id: BytesN<32>) -> Payment {
        env.storage().instance().get(&DataKey::Payments(payment_id)).unwrap()
    }

    pub fn get_payment_by_tx(env: Env, tx_hash: BytesN<32>) -> Payment {
        let payment_id: BytesN<32> = env.storage().instance()
            .get(&DataKey::PaymentByTxHash(tx_hash))
            .unwrap();
        env.storage().instance().get(&DataKey::Payments(payment_id)).unwrap()
    }

    pub fn get_payer_payments(env: Env, payer: Address) -> Vec<BytesN<32>> {
        env.storage().instance().get(&DataKey::PayerPayments(payer)).unwrap_or(Vec::new(&env))
    }

    pub fn get_payee_payments(env: Env, payee: Address) -> Vec<BytesN<32>> {
        env.storage().instance().get(&DataKey::PayeePayments(payee)).unwrap_or(Vec::new(&env))
    }

    pub fn get_stats(env: Env) -> (i128, u64, u64, u64) {
        let total_volume: i128 = env.storage().instance().get(&DataKey::TotalVolume).unwrap_or(0);
        let total_payments: u64 = env.storage().instance().get(&DataKey::TotalPayments).unwrap_or(0);
        let total_verified: u64 = env.storage().instance().get(&DataKey::TotalVerified).unwrap_or(0);
        let total_settled: u64 = env.storage().instance().get(&DataKey::TotalSettled).unwrap_or(0);
        (total_volume, total_payments, total_verified, total_settled)
    }

    pub fn set_verifier_authorization(env: Env, verifier: Address, authorized: bool) {
        let owner = get_owner(&env);
        owner.require_auth();
        env.storage().instance().set(&DataKey::AuthorizedVerifiers(verifier.clone()), &authorized);
        env.events().publish(
            (symbol_short!("VrfAuth"), verifier),
            authorized,
        );
    }

    pub fn set_fee(env: Env, fee_bps: u64) {
        let owner = get_owner(&env);
        owner.require_auth();
        assert!(fee_bps <= 1000, "Fee too high");
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
    }
}
