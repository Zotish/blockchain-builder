# ChainForge — Blockchain Builder Platform

> **Build Any Blockchain in Minutes** — Create, configure, and deploy any type of blockchain network, from testnet to mainnet.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Running the Application

```bash
# Terminal 1 — Start Backend API
cd backend
npm run dev

# Terminal 2 — Start Frontend
cd frontend
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health**: http://localhost:5000/api/health

## 🔗 Supported Blockchains

| Type | Chains | Consensus |
|------|--------|-----------|
| **EVM** | Ethereum, BSC, Polygon, Avalanche, L2 Rollups | PoS, PoA, PoW, DPoS |
| **Substrate** | Standalone, Parachain, Smart Contract | Aura+GRANDPA, BABE |
| **Cosmos** | Standard, IBC, DeFi | Tendermint BFT |
| **Hyperledger** | Fabric, Besu | Raft, IBFT 2.0 |
| **Solana** | Fork | PoH + PoS |
| **DAG** | IOTA-style | Tip Selection |
| **Custom** | Build your own | Any |

## 📁 Project Structure

```
├── frontend/          # Next.js 14 Frontend
│   ├── app/           # Pages (landing, auth, builder, dashboard, explorer, payment)
│   └── lib/           # API client utilities
├── backend/           # Express API Server
│   ├── src/
│   │   ├── routes/    # API endpoints
│   │   ├── models/    # Data store
│   │   ├── middleware/ # Auth middleware
│   │   └── config/    # Configuration
│   └── templates/     # Blockchain templates
├── contracts/         # Payment smart contracts
└── docker-compose.yml # Docker setup
```

## 💰 Pricing

| Plan | Price | Features |
|------|-------|----------|
| Testnet | **Free** | Unlimited chains, full config, explorer |
| Basic | **0.1 ETH** | 1 node, basic support |
| Standard | **0.3 ETH** | 3 nodes, priority support, explorer |
| Enterprise | **1.0 ETH** | 5+ nodes, 24/7 support, custom domain |

## 🛠 API Endpoints

- `POST /api/auth/register` — Register
- `POST /api/auth/login` — Login
- `GET /api/templates` — List templates
- `POST /api/chains` — Create chain
- `POST /api/deploy/testnet/:id` — Deploy testnet
- `POST /api/payment/create` — Create payment
- `POST /api/deploy/mainnet/:id` — Deploy mainnet

---

Built with ❤️ by ChainForge
