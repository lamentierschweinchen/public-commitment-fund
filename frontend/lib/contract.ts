import {
  AbiRegistry,
  Address,
  ResultsParser,
  SmartContract,
} from '@multiversx/sdk-core';
import abiJson from '@/contracts/public-commitment-fund.abi.json';
import { contractAddress } from '@/config';

const abiRegistry = AbiRegistry.create(abiJson as unknown as object);

export function getContract() {
  return new SmartContract({
    address: Address.newFromBech32(contractAddress),
    abi: abiRegistry,
  });
}

export function getResultsParser() {
  return new ResultsParser();
}
