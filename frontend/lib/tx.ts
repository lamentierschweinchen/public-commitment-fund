import { Address } from '@multiversx/sdk-core';
import { contractAddress } from '@/config';
import { getContract } from '@/lib/contract';

export interface DappTransactionPayload {
  value: string;
  data: string;
  receiver: string;
  gasLimit: string;
  chainID: string;
}

interface InteractionLike {
  withSender(sender: Address): InteractionLike;
  withChainID(chainId: string): InteractionLike;
  withGasLimit(gasLimit: unknown): InteractionLike;
  withValue(value: unknown): InteractionLike;
  buildTransaction(): {
    getValue(): { toString(): string };
    getData(): { toString(): string };
    getGasLimit(): { toString(): string };
  };
}

function interactionToPayload(params: {
  interaction: InteractionLike;
  sender: string;
  chainId: string;
  gasLimit: number | string | bigint;
  valueWei?: string;
}): DappTransactionPayload {
  const { interaction, sender, chainId, gasLimit, valueWei } = params;
  interaction.withSender(Address.newFromBech32(sender));
  interaction.withChainID(chainId);
  interaction.withGasLimit(gasLimit);

  if (valueWei) {
    interaction.withValue(BigInt(valueWei));
  }

  const tx = interaction.buildTransaction();

  return {
    value: tx.getValue().toString(),
    data: tx.getData().toString(),
    receiver: contractAddress,
    gasLimit: tx.getGasLimit().toString(),
    chainID: chainId,
  };
}

export function buildCreateCommitmentPayload(params: {
  sender: string;
  chainId: string;
  title: string;
  recipient: string;
  deadline: number;
  amountWei: string;
  cooldownSeconds?: number;
}): DappTransactionPayload {
  const contract = getContract();
  const args: Array<string | number> = [
    params.title,
    params.recipient,
    params.deadline,
  ];

  if (typeof params.cooldownSeconds === 'number') {
    args.push(params.cooldownSeconds);
  }

  const interaction = contract.methods.create_commitment(args);

  return interactionToPayload({
    interaction,
    sender: params.sender,
    chainId: params.chainId,
    gasLimit: 30_000_000n,
    valueWei: params.amountWei,
  });
}

export function buildSubmitProofPayload(params: {
  sender: string;
  chainId: string;
  id: number;
  proofUrl: string;
}): DappTransactionPayload {
  const contract = getContract();
  const interaction = contract.methods.submit_proof([params.id, params.proofUrl]);

  return interactionToPayload({
    interaction,
    sender: params.sender,
    chainId: params.chainId,
    gasLimit: 15_000_000n,
  });
}

export function buildFinalizePayload(params: {
  sender: string;
  chainId: string;
  id: number;
}): DappTransactionPayload {
  const contract = getContract();
  const interaction = contract.methods.finalize([params.id]);

  return interactionToPayload({
    interaction,
    sender: params.sender,
    chainId: params.chainId,
    gasLimit: 15_000_000n,
  });
}

export function buildClaimPayload(params: {
  sender: string;
  chainId: string;
  id: number;
}): DappTransactionPayload {
  const contract = getContract();
  const interaction = contract.methods.claim([params.id]);

  return interactionToPayload({
    interaction,
    sender: params.sender,
    chainId: params.chainId,
    gasLimit: 15_000_000n,
  });
}

export function buildCancelPayload(params: {
  sender: string;
  chainId: string;
  id: number;
}): DappTransactionPayload {
  const contract = getContract();
  const interaction = contract.methods.cancel([params.id]);

  return interactionToPayload({
    interaction,
    sender: params.sender,
    chainId: params.chainId,
    gasLimit: 15_000_000n,
  });
}
