#![no_std]

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

pub const STATUS_ACTIVE: u8 = 0;
pub const STATUS_COMPLETED: u8 = 1;
pub const STATUS_FAILED: u8 = 2;
pub const STATUS_REFUNDED: u8 = 3;
pub const STATUS_CLAIMED: u8 = 4;

const DEFAULT_COOLDOWN_SECONDS: u64 = 86_400;
const MIN_DEADLINE_BUFFER_SECONDS: u64 = 300;
const MAX_TITLE_BYTES: usize = 64;
const MAX_PROOF_URL_BYTES: usize = 512;

#[type_abi]
#[derive(
    TopEncode,
    TopDecode,
    NestedEncode,
    NestedDecode,
    ManagedVecItem,
    Clone,
    PartialEq,
    Debug,
)]
pub struct Commitment<M: ManagedTypeApi> {
    pub id: u64,
    pub creator: ManagedAddress<M>,
    pub recipient: ManagedAddress<M>,
    pub amount: BigUint<M>,
    pub deadline: u64,
    pub cooldown_seconds: u64,
    pub created_at: u64,
    pub status: u8,
    pub title: ManagedBuffer<M>,
    pub proof_url: ManagedBuffer<M>,
    pub proof_hash: ManagedBuffer<M>,
    pub proof_submitted_at: u64,
    pub finalized_at: u64,
}

#[multiversx_sc::contract]
pub trait PublicCommitmentFund {
    #[init]
    fn init(&self) {
        self.next_id().set(1u64);
    }

    #[payable("EGLD")]
    #[endpoint(create_commitment)]
    fn create_commitment(
        &self,
        title: ManagedBuffer,
        recipient: ManagedAddress,
        deadline: u64,
        cooldown_seconds_opt: OptionalValue<u64>,
    ) {
        let payment = self.call_value().egld();
        require!(*payment > 0u64, "Amount must be > 0");
        require!(!recipient.is_zero(), "Recipient cannot be zero address");
        require!(title.len() <= MAX_TITLE_BYTES, "Title too long");

        let now = self.now();
        require!(
            deadline > now + MIN_DEADLINE_BUFFER_SECONDS,
            "Deadline too soon"
        );

        let cooldown_seconds = match cooldown_seconds_opt {
            OptionalValue::Some(value) => value,
            OptionalValue::None => DEFAULT_COOLDOWN_SECONDS,
        };
        require!(cooldown_seconds > 0, "Cooldown must be > 0");

        let id = self.next_id().get();
        self.next_id().set(id + 1);

        let creator = self.blockchain().get_caller();
        let amount = payment.clone_value();

        let commitment = Commitment {
            id,
            creator: creator.clone(),
            recipient: recipient.clone(),
            amount: amount.clone(),
            deadline,
            cooldown_seconds,
            created_at: now,
            status: STATUS_ACTIVE,
            title,
            proof_url: ManagedBuffer::new(),
            proof_hash: ManagedBuffer::new(),
            proof_submitted_at: 0,
            finalized_at: 0,
        };

        self.commitments(id).set(commitment);
        self.all_ids().push(&id);

        self.commitment_created_event(id, creator, recipient, amount, deadline, cooldown_seconds);
    }

    #[endpoint(submit_proof)]
    fn submit_proof(&self, id: u64, proof_url: ManagedBuffer) {
        let mut commitment = self.get_commitment_or_fail(id);

        let caller = self.blockchain().get_caller();
        require!(caller == commitment.creator, "Only creator can submit proof");
        require!(commitment.status == STATUS_ACTIVE, "Commitment is not active");
        require!(
            proof_url.len() > 0 && proof_url.len() <= MAX_PROOF_URL_BYTES,
            "Invalid proof URL length"
        );

        let now = self.now();
        require!(now <= commitment.deadline, "Deadline passed");
        require!(
            commitment.proof_url.is_empty() && commitment.proof_submitted_at == 0,
            "Proof already submitted"
        );

        let hash = self.crypto().sha256(&proof_url);
        let proof_hash = hash.as_managed_buffer().clone();

        commitment.proof_url = proof_url;
        commitment.proof_hash = proof_hash.clone();
        commitment.proof_submitted_at = now;
        commitment.status = STATUS_COMPLETED;

        self.commitments(id).set(commitment);
        self.proof_submitted_event(id, proof_hash);
    }

    #[endpoint(finalize)]
    fn finalize(&self, id: u64) {
        let mut commitment = self.get_commitment_or_fail(id);
        let now = self.now();

        require!(now > commitment.deadline, "Deadline not reached");
        require!(
            commitment.status == STATUS_ACTIVE || commitment.status == STATUS_COMPLETED,
            "Commitment cannot be finalized"
        );

        commitment.finalized_at = now;

        if commitment.status == STATUS_COMPLETED {
            self.send().direct_egld(&commitment.creator, &commitment.amount);
            commitment.status = STATUS_REFUNDED;
            self.commitments(id).set(commitment);
            self.refunded_event(id);
            return;
        }

        commitment.status = STATUS_FAILED;
        self.commitments(id).set(commitment);
        self.failed_finalized_event(id);
    }

    #[endpoint(claim)]
    fn claim(&self, id: u64) {
        let mut commitment = self.get_commitment_or_fail(id);

        let caller = self.blockchain().get_caller();
        require!(caller == commitment.recipient, "Only recipient can claim");
        require!(commitment.status == STATUS_FAILED, "Commitment is not failed");
        require!(commitment.finalized_at > 0, "Commitment not finalized");

        let now = self.now();
        let claim_time = commitment.finalized_at + commitment.cooldown_seconds;
        require!(now >= claim_time, "Cooldown not reached");

        self.send().direct_egld(&commitment.recipient, &commitment.amount);
        commitment.status = STATUS_CLAIMED;
        self.commitments(id).set(commitment);

        self.claimed_event(id);
    }

    #[endpoint(cancel)]
    fn cancel(&self, id: u64) {
        let mut commitment = self.get_commitment_or_fail(id);

        let caller = self.blockchain().get_caller();
        require!(caller == commitment.creator, "Only creator can cancel");
        require!(commitment.status == STATUS_ACTIVE, "Commitment is not active");

        let now = self.now();
        require!(now < commitment.deadline, "Deadline already reached");
        require!(commitment.proof_submitted_at == 0, "Proof already submitted");

        self.send().direct_egld(&commitment.creator, &commitment.amount);
        commitment.status = STATUS_REFUNDED;
        commitment.finalized_at = now;
        self.commitments(id).set(commitment);

        self.cancelled_event(id);
    }

    #[view(get_commitment)]
    fn get_commitment(&self, id: u64) -> Commitment<Self::Api> {
        self.get_commitment_or_fail(id)
    }

    #[view(get_total_ids)]
    fn get_total_ids(&self) -> u64 {
        self.all_ids().len() as u64
    }

    #[view(get_ids_page)]
    fn get_ids_page(&self, start: u64, limit: u64) -> MultiValueEncoded<u64> {
        let mut result = MultiValueEncoded::new();

        if limit == 0 {
            return result;
        }

        let total = self.all_ids().len();
        let start_zero_based = start as usize;
        if start_zero_based >= total {
            return result;
        }

        let end_exclusive = core::cmp::min(total, start_zero_based.saturating_add(limit as usize));
        for zero_index in start_zero_based..end_exclusive {
            let mapper_index = zero_index + 1;
            result.push(self.all_ids().get(mapper_index));
        }

        result
    }

    #[view(get_commitments_batch)]
    fn get_commitments_batch(&self, ids: MultiValueEncoded<u64>) -> MultiValueEncoded<Commitment<Self::Api>> {
        let mut result = MultiValueEncoded::new();

        for id in ids.into_iter() {
            if self.commitments(id).is_empty() {
                continue;
            }
            result.push(self.commitments(id).get());
        }

        result
    }

    fn get_commitment_or_fail(&self, id: u64) -> Commitment<Self::Api> {
        require!(!self.commitments(id).is_empty(), "Commitment not found");
        self.commitments(id).get()
    }

    fn now(&self) -> u64 {
        self.blockchain().get_block_timestamp_seconds().as_u64_seconds()
    }

    #[event("CommitmentCreated")]
    fn commitment_created_event(
        &self,
        #[indexed] id: u64,
        #[indexed] creator: ManagedAddress,
        #[indexed] recipient: ManagedAddress,
        #[indexed] amount: BigUint,
        #[indexed] deadline: u64,
        #[indexed] cooldown: u64,
    );

    #[event("ProofSubmitted")]
    fn proof_submitted_event(&self, #[indexed] id: u64, proof_hash: ManagedBuffer);

    #[event("FailedFinalized")]
    fn failed_finalized_event(&self, #[indexed] id: u64);

    #[event("Refunded")]
    fn refunded_event(&self, #[indexed] id: u64);

    #[event("Claimed")]
    fn claimed_event(&self, #[indexed] id: u64);

    #[event("Cancelled")]
    fn cancelled_event(&self, #[indexed] id: u64);

    #[storage_mapper("next_id")]
    fn next_id(&self) -> SingleValueMapper<u64>;

    #[storage_mapper("commitments")]
    fn commitments(&self, id: u64) -> SingleValueMapper<Commitment<Self::Api>>;

    #[storage_mapper("all_ids")]
    fn all_ids(&self) -> VecMapper<u64>;
}
