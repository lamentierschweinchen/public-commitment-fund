import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_WASM = ROOT / "contract" / "output" / "public-commitment-fund.wasm"
DEFAULT_OUTFILE = ROOT / "deploy.json"

PEM_FILE = os.getenv("PEM_FILE", str(ROOT / "wallet.pem"))
PROXY = os.getenv("MVX_PROXY", "https://devnet-api.multiversx.com")
CHAIN_ID = os.getenv("MVX_CHAIN_ID", "D")
GAS_LIMIT = int(os.getenv("DEPLOY_GAS_LIMIT", "80000000"))


def run(cmd: str) -> subprocess.CompletedProcess:
    print(f"$ {cmd}")
    return subprocess.run(
        cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=str(ROOT),
    )


def deploy() -> int:
    if not CONTRACT_WASM.exists():
        print(f"Missing wasm file: {CONTRACT_WASM}")
        print("Build first: cd contract/meta && cargo run -- build")
        return 1

    outfile = os.getenv("DEPLOY_OUTFILE", str(DEFAULT_OUTFILE))

    cmd = " ".join(
        [
            "mxpy contract deploy",
            f"--bytecode={shlex.quote(str(CONTRACT_WASM))}",
            f"--pem={shlex.quote(PEM_FILE)}",
            f"--gas-limit={GAS_LIMIT}",
            f"--proxy={shlex.quote(PROXY)}",
            f"--chain={shlex.quote(CHAIN_ID)}",
            "--send",
            f"--outfile={shlex.quote(outfile)}",
        ]
    )

    result = run(cmd)
    print(result.stdout)

    if result.returncode != 0:
        print("Deployment failed.")
        return result.returncode

    try:
        with open(outfile, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        tx_hash = payload.get("emittedTransactionHash")
        contract_address = payload.get("contractAddress")
        print(f"emittedTransactionHash: {tx_hash}")
        print(f"contractAddress: {contract_address}")
    except Exception as error:
        print(f"Could not parse deploy output file: {error}")

    return 0


if __name__ == "__main__":
    sys.exit(deploy())
