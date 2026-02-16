use multiversx_sc::types::{ManagedAddress, ManagedBuffer, TimestampSeconds};
use multiversx_sc_scenario::imports::*;
use public_commitment_fund::{
    PublicCommitmentFund, STATUS_ACTIVE, STATUS_CLAIMED, STATUS_COMPLETED, STATUS_FAILED,
    STATUS_REFUNDED,
};

const INIT_TS: u64 = 1_000;
const ONE_EGLD: u64 = 1_000_000_000_000_000_000;
const WASM_PATH: &str = "output/public-commitment-fund.wasm";

type ScWrapper = ContractObjWrapper<
    public_commitment_fund::ContractObj<DebugApi>,
    fn() -> public_commitment_fund::ContractObj<DebugApi>,
>;

fn mb(bytes: &[u8]) -> ManagedBuffer<DebugApi> {
    ManagedBuffer::new_from_bytes(bytes)
}

fn setup() -> (BlockchainStateWrapper, Address, Address, Address, ScWrapper) {
    assert!(
        std::path::Path::new(WASM_PATH).exists(),
        "Missing {WASM_PATH}. Build the contract first (from contract/meta): `cargo run -- build`."
    );

    let mut b_wrapper = BlockchainStateWrapper::new();

    let creator = b_wrapper.create_user_account(&rust_biguint!(10 * ONE_EGLD));
    let recipient = b_wrapper.create_user_account(&rust_biguint!(10 * ONE_EGLD));
    let stranger = b_wrapper.create_user_account(&rust_biguint!(10 * ONE_EGLD));

    let sc_wrapper = b_wrapper.create_sc_account(
        &rust_biguint!(0),
        Some(&creator),
        public_commitment_fund::contract_obj::<DebugApi>
            as fn() -> public_commitment_fund::ContractObj<DebugApi>,
        WASM_PATH,
    );

    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(INIT_TS));
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0), |sc| {
            sc.init();
        })
        .assert_ok();

    (b_wrapper, creator, recipient, stranger, sc_wrapper)
}

fn create_default(
    b_wrapper: &mut BlockchainStateWrapper,
    creator: &Address,
    recipient: &Address,
    sc_wrapper: &ScWrapper,
    deadline: u64,
    value: u64,
) {
    b_wrapper
        .execute_tx(creator, sc_wrapper, &rust_biguint!(value), |sc| {
            sc.create_commitment(
                mb(b"Ship weekly report"),
                recipient.clone().into(),
                deadline,
                OptionalValue::None,
            );
        })
        .assert_ok();
}

#[test]
fn create_commitment_stores_data_and_id() {
    let (mut b_wrapper, creator, recipient, _stranger, sc_wrapper) = setup();
    let deadline = INIT_TS + 1_000;

    create_default(
        &mut b_wrapper,
        &creator,
        &recipient,
        &sc_wrapper,
        deadline,
        ONE_EGLD,
    );

    b_wrapper
        .execute_query(&sc_wrapper, |sc| {
            assert_eq!(sc.next_id().get(), 2u64);
            assert_eq!(sc.all_ids().len(), 1usize);
            assert_eq!(sc.all_ids().get(1), 1u64);

            let c = sc.commitments(1).get();
            assert_eq!(c.id, 1u64);
            assert_eq!(
                c.creator,
                ManagedAddress::<DebugApi>::from_address(&creator.clone())
            );
            assert_eq!(
                c.recipient,
                ManagedAddress::<DebugApi>::from_address(&recipient.clone())
            );
            assert_eq!(c.amount, BigUint::from(ONE_EGLD));
            assert_eq!(c.deadline, deadline);
            assert_eq!(c.cooldown_seconds, 86_400u64);
            assert_eq!(c.status, STATUS_ACTIVE);
            assert_eq!(c.proof_submitted_at, 0u64);
            assert_eq!(c.finalized_at, 0u64);
        })
        .assert_ok();
}

#[test]
fn create_validations_enforced() {
    let (mut b_wrapper, creator, recipient, _stranger, sc_wrapper) = setup();

    // Zero amount
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.create_commitment(
                mb(b"Title"),
                recipient.clone().into(),
                INIT_TS + 1_000,
                OptionalValue::None,
            );
        })
        .assert_user_error("Amount must be > 0");

    // Deadline too soon
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(1u64), |sc| {
            sc.create_commitment(
                mb(b"Title"),
                recipient.clone().into(),
                INIT_TS + 299,
                OptionalValue::None,
            );
        })
        .assert_user_error("Deadline too soon");

    // Zero recipient
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(1u64), |sc| {
            sc.create_commitment(
                mb(b"Title"),
                ManagedAddress::zero(),
                INIT_TS + 1_000,
                OptionalValue::None,
            );
        })
        .assert_user_error("Recipient cannot be zero address");

    // Title too long
    let long_title = vec![b'x'; 65];
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(1u64), |sc| {
            sc.create_commitment(
                ManagedBuffer::new_from_bytes(long_title.as_slice()),
                recipient.clone().into(),
                INIT_TS + 1_000,
                OptionalValue::None,
            );
        })
        .assert_user_error("Title too long");
}

#[test]
fn submit_proof_allows_deadline_boundary_and_blocks_overwrite() {
    let (mut b_wrapper, creator, recipient, _stranger, sc_wrapper) = setup();
    let deadline = INIT_TS + 700;
    create_default(
        &mut b_wrapper,
        &creator,
        &recipient,
        &sc_wrapper,
        deadline,
        ONE_EGLD,
    );

    // Boundary: now == deadline is allowed.
    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(deadline));
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.submit_proof(1u64, mb(b"https://example.com/proof/1"));
        })
        .assert_ok();

    b_wrapper
        .execute_query(&sc_wrapper, |sc| {
            let c = sc.commitments(1).get();
            assert_eq!(c.status, STATUS_COMPLETED);
            assert_eq!(c.proof_submitted_at, deadline);
            assert_eq!(c.proof_hash.len(), 32usize);
        })
        .assert_ok();

    // Overwrite must fail.
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.submit_proof(1u64, mb(b"https://example.com/proof/overwrite"));
        })
        .assert_user_error("Commitment is not active");
}

#[test]
fn submit_proof_rejects_after_deadline_and_non_creator() {
    let (mut b_wrapper, creator, recipient, stranger, sc_wrapper) = setup();
    let deadline = INIT_TS + 700;
    create_default(
        &mut b_wrapper,
        &creator,
        &recipient,
        &sc_wrapper,
        deadline,
        ONE_EGLD,
    );

    // Non-creator
    b_wrapper
        .execute_tx(&stranger, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.submit_proof(1u64, mb(b"https://example.com/proof"));
        })
        .assert_user_error("Only creator can submit proof");

    // After deadline
    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(deadline + 1));
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.submit_proof(1u64, mb(b"https://example.com/proof"));
        })
        .assert_user_error("Deadline passed");
}

#[test]
fn finalize_active_marks_failed_and_double_finalize_reverts() {
    let (mut b_wrapper, creator, recipient, _stranger, sc_wrapper) = setup();
    let deadline = INIT_TS + 700;
    create_default(
        &mut b_wrapper,
        &creator,
        &recipient,
        &sc_wrapper,
        deadline,
        ONE_EGLD,
    );

    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.finalize(1u64);
        })
        .assert_user_error("Deadline not reached");

    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(deadline + 1));
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.finalize(1u64);
        })
        .assert_ok();

    b_wrapper
        .execute_query(&sc_wrapper, |sc| {
            let c = sc.commitments(1).get();
            assert_eq!(c.status, STATUS_FAILED);
            assert_eq!(c.finalized_at, deadline + 1);
        })
        .assert_ok();

    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.finalize(1u64);
        })
        .assert_user_error("Commitment cannot be finalized");
}

#[test]
fn finalize_completed_refunds_creator() {
    let (mut b_wrapper, creator, recipient, stranger, sc_wrapper) = setup();
    let deadline = INIT_TS + 700;
    create_default(
        &mut b_wrapper,
        &creator,
        &recipient,
        &sc_wrapper,
        deadline,
        ONE_EGLD,
    );

    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(deadline));
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.submit_proof(1u64, mb(b"https://example.com/proof"));
        })
        .assert_ok();

    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(deadline + 1));
    b_wrapper
        .execute_tx(&stranger, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.finalize(1u64);
        })
        .assert_ok();

    b_wrapper
        .execute_query(&sc_wrapper, |sc| {
            let c = sc.commitments(1).get();
            assert_eq!(c.status, STATUS_REFUNDED);
            assert_eq!(c.finalized_at, deadline + 1);
        })
        .assert_ok();
}

#[test]
fn claim_requires_failed_and_cooldown() {
    let (mut b_wrapper, creator, recipient, stranger, sc_wrapper) = setup();
    let deadline = INIT_TS + 700;
    create_default(
        &mut b_wrapper,
        &creator,
        &recipient,
        &sc_wrapper,
        deadline,
        ONE_EGLD,
    );

    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(deadline + 1));
    b_wrapper
        .execute_tx(&stranger, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.finalize(1u64);
        })
        .assert_ok();

    b_wrapper
        .execute_tx(&stranger, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.claim(1u64);
        })
        .assert_user_error("Only recipient can claim");

    b_wrapper
        .execute_tx(&recipient, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.claim(1u64);
        })
        .assert_user_error("Cooldown not reached");

    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(deadline + 1 + 86_400));
    b_wrapper
        .execute_tx(&recipient, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.claim(1u64);
        })
        .assert_ok();

    b_wrapper
        .execute_query(&sc_wrapper, |sc| {
            let c = sc.commitments(1).get();
            assert_eq!(c.status, STATUS_CLAIMED);
        })
        .assert_ok();

    b_wrapper
        .execute_tx(&recipient, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.claim(1u64);
        })
        .assert_user_error("Commitment is not failed");
}

#[test]
fn cancel_only_creator_before_deadline() {
    let (mut b_wrapper, creator, recipient, stranger, sc_wrapper) = setup();
    let deadline = INIT_TS + 700;
    create_default(
        &mut b_wrapper,
        &creator,
        &recipient,
        &sc_wrapper,
        deadline,
        ONE_EGLD,
    );

    b_wrapper
        .execute_tx(&stranger, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.cancel(1u64);
        })
        .assert_user_error("Only creator can cancel");

    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.cancel(1u64);
        })
        .assert_ok();

    b_wrapper
        .execute_query(&sc_wrapper, |sc| {
            let c = sc.commitments(1).get();
            assert_eq!(c.status, STATUS_REFUNDED);
            assert_eq!(c.finalized_at, INIT_TS);
        })
        .assert_ok();
}

#[test]
fn cancel_after_deadline_reverts() {
    let (mut b_wrapper, creator, recipient, _stranger, sc_wrapper) = setup();
    let deadline = INIT_TS + 700;
    create_default(
        &mut b_wrapper,
        &creator,
        &recipient,
        &sc_wrapper,
        deadline,
        ONE_EGLD,
    );

    b_wrapper.set_block_timestamp_seconds(TimestampSeconds::new(deadline));
    b_wrapper
        .execute_tx(&creator, &sc_wrapper, &rust_biguint!(0u64), |sc| {
            sc.cancel(1u64);
        })
        .assert_user_error("Deadline already reached");
}

#[test]
fn view_pagination_and_batch() {
    let (mut b_wrapper, creator, recipient, _stranger, sc_wrapper) = setup();

    for i in 0..3u64 {
        create_default(
            &mut b_wrapper,
            &creator,
            &recipient,
            &sc_wrapper,
            INIT_TS + 1_000 + i,
            ONE_EGLD,
        );
    }

    b_wrapper
        .execute_query(&sc_wrapper, |sc| {
            assert_eq!(sc.get_total_ids(), 3u64);

            let page = sc.get_ids_page(1u64, 2u64);
            let ids: Vec<u64> = page.into_iter().collect();
            assert_eq!(ids, vec![2u64, 3u64]);

            let mut req = MultiValueEncoded::new();
            req.push(1u64);
            req.push(3u64);
            let commitments = sc.get_commitments_batch(req);
            let list: Vec<public_commitment_fund::Commitment<DebugApi>> =
                commitments.into_iter().collect();
            assert_eq!(list.len(), 2usize);
            assert_eq!(list[0].id, 1u64);
            assert_eq!(list[1].id, 3u64);
        })
        .assert_ok();
}
