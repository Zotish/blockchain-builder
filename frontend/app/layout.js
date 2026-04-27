import './globals.css';

export const metadata = {
  title: 'ChainForge — Build Any Blockchain | Testnet & Mainnet Deployment',
  description: 'Create, configure, and deploy any type of blockchain in minutes. From EVM chains to Cosmos SDK, Substrate, and fully custom blockchains. Free testnet, crypto-powered mainnet launch.',
  keywords: 'blockchain builder, create blockchain, deploy blockchain, EVM, Substrate, Cosmos, testnet, mainnet, BaaS',
  openGraph: {
    title: 'ChainForge — Build Any Blockchain',
    description: 'The ultimate Blockchain-as-a-Service platform. Create and launch any blockchain.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a1a" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
