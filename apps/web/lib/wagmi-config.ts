import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { getDefaultConfig } from "connectkit";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const chains = [base, baseSepolia] as const;
const transports = {
  [base.id]: http(),
  [baseSepolia.id]: http(),
} as const;

const baseConfig = walletConnectProjectId
  ? getDefaultConfig({
      appName: "AFL · Autonomous Football League",
      appDescription:
        "Vault your $AFL tokens and earn yield. 25% of fees fund the playoff prize pool.",
      walletConnectProjectId,
      chains,
      transports,
    })
  : {
      chains,
      transports,
      connectors: [injected()],
    };

export const wagmiConfig = createConfig({
  ...baseConfig,
  ssr: false,
});

