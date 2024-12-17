import { IAgentRuntime, composeContext, elizaLogger, messageCompletionFooter, generateMessageResponse, ModelClass } from "@ai16z/eliza";
import { ClientBase } from "./base";
import { stringToUuid, getEmbeddingZeroVector } from "@ai16z/eliza";

export const getTopTokensPricesByVolume = async () => {
    const symbolsUrl = 'https://api.binance.com/api/v3/ticker/24hr';
      try {
        const symbolsResponse = await fetch(symbolsUrl);
        const symbolsData = await symbolsResponse.json();

    // Sort by volume and pick top N
    const sortedByVolume = symbolsData.sort(
        (a:any, b:any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
    );
    // const topTokens = sortedByVolume.slice(0, topN).map(token => token.symbol);

    const prices = sortedByVolume
    return prices;

      } catch (error) {
        console.log("FETCH FAILED during symbols fetching");

    // Handle the error appropriately
    return [];

      }

}

const RELATED_TOKENS = [
    "BTC",     // Bitcoin
    "ETH",     // Ethereum
    "USDT",    // Tether
    "BNB",     // Binance Coin
    "SOL",     // Solana
    "XRP",     // XRP
    "USDC",    // USD Coin
    "ADA",     // Cardano
    "ARB",     // Cardano
    "LINK",    // Chainlink
    "RUNE",    // THORChain
    "RNDR",    // Render Token
    "MATIC",   // Polygon
    "AAVE",    // Aave
    "DOT",     // Polkadot
    "KSM",     // Kusama
    "PEPE",    // Pepe
    "WIF",    // Pepe
    "GRT",     // The Graph
    "AVAX",    // Avalanche
    "LTC",     // Litecoin
    "SHIB",    // Shiba Inu
    "UNI",     // Uniswap
    "XMR",     // Monero
    "ETC",     // Ethereum Classic
    "FIL",     // Filecoin
    "OP",      // Optimism
    "ARB",     // Arbitrum
    "TIA",     // Celestia
    "LUNC",    // Terra Classic
    "FTM",     // Fantom
    "MANA",    // Decentraland
    "AXS",     // Axie Infinity
    "CAKE",    // PancakeSwap
    "AR",      // Arweave
    "INJ",     // Injective Protocol
    "TRB",     // Tellor
    "SOL",     // Solana
    "JTO",     // Just Token
    "ENJ",     // Enjin Coin
    "STETH",   // Lido Staked Ether
    "TRX",     // TRON
    "TON",     // Toncoin
    "WBTC",    // Wrapped Bitcoin
    "DAI",     // Dai
    "BCH",     // Bitcoin Cash
    "ATOM",    // Cosmos
    "ICP",     // Internet Computer
    "NEAR",    // NEAR Protocol
    "XLM",     // Stellar
    "HBAR",    // Hedera Hashgraph
    "APT",     // Aptos
    "CRO",     // Cronos
    "STX",     // Stacks
    "QNT",     // Quant
    "MNT",     // Mantle
    "TAO",     // Bittensor
    "ALGO",    // Algorand
    "EGLD",    // MultiversX
    "FDUSD",   // First Digital USD
    "BSV",     // Bitcoin SV
    "RETH",    // Rocket Pool ETH
    "FLOW",    // Flow
    "MKR",     // Maker
    "ORDI",    // ORDI
    "MINA",    // Mina Protocol
    "THETA",   // Theta Network
    "BTT",     // BitTorrent
    "SAND",    // The Sandbox
    "OSMO",    // Osmosis
    "WEMIX",   // WEMIX
    "KCS",     // KuCoin Token
    "GALA",    // Gala
    "SEI",     // Sei Network
    "EOS",     // EOS
    "BUSD",    // Binance USD
    "KAVA",    // Kava
    "NEO",     // NEO
    "TKX",     // Tokenize Xchange
    "SNX",     // Synthetix
    "SUI",     //
    "ROSE",     //
  ];
  import { Context, Telegraf } from "telegraf";

export class ScalpingIdeaClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    tg_bot: Telegraf<Context>;
    constructor(client: ClientBase, runtime: IAgentRuntime, tg_bot: Telegraf<Context>) {
        this.client = client;
        this.tg_bot = tg_bot;
        this.runtime = runtime;
    }

    public startLoop() {
        elizaLogger.log("scalpt startLoop");
        this.handleMainLoopBody();
        elizaLogger.log("Starting scalping loop");
        setTimeout(
            () => this.startLoop(),
            Number(2640) * 1000 // 44 minutes
        );
    }

    private async handleMainLoopBody() {
        elizaLogger.log("getTopTokensPricesByVolume");
        const topTokens = await getTopTokensPricesByVolume();
        // remove pairs usdt at the start
        const filteredOut = topTokens.filter((token: any) => !token.symbol.startsWith("USDT"));
        // it has to include both sides of the pair in RELATED_TOKENS
        const filteredOut2 = filteredOut.filter((token: any) => RELATED_TOKENS.includes(token.symbol));


        // top 3 tokens
        const top3Tokens = filteredOut2.slice(0, 10);
        console.log(top3Tokens);
        elizaLogger.log(top3Tokens);
        // get a random token
        const randomToken = top3Tokens[Math.floor(Math.random() * top3Tokens.length)];
        console.log(randomToken);
        elizaLogger.log(randomToken);

        // get a scalp idea for the token
        const scalpIdea = await getScalpIdea(this.runtime, randomToken);
        console.log(scalpIdea);
        elizaLogger.log(scalpIdea);
        elizaLogger.log("sending message to telegram " + this.runtime.getSetting("TELEGRAM_CHANNEL_ID"));
        this.tg_bot.telegram.sendMessage(this.runtime.getSetting("TELEGRAM_CHANNEL_ID"), scalpIdea);
        // send to group chat

        // Post tweet and save as memory
        // try {
        //     if (this.runtime.getSetting("TWITTER_DRY_RUN") === "true") {
        //         elizaLogger.info(`Dry run: would have posted scalp idea: ${scalpIdea}`);
        //         return;
        //     }

        //     elizaLogger.log(`Posting new scalp idea:\n ${scalpIdea}`);

        //     const result = await this.client.requestQueue.add(
        //         async () => await this.client.twitterClient.sendTweet(scalpIdea)
        //     );
        //     const body = await result.json();

        //     if (!body?.data?.create_tweet?.tweet_results?.result) {
        //         console.error("Error sending tweet; Bad response:", body);
        //         return;
        //     }

        //     const tweetResult = body.data.create_tweet.tweet_results.result;
        //     const tweet = {
        //         id: tweetResult.rest_id,
        //         text: tweetResult.legacy.full_text,
        //         timestamp: new Date(tweetResult.legacy.created_at).getTime(),
        //         permanentUrl: `https://twitter.com/${this.runtime.getSetting("TWITTER_USERNAME")}/status/${tweetResult.rest_id}`,
        //     };

        //     // Save as memory
        //     const roomId = stringToUuid(`scalping-room-${this.runtime.agentId}`);

        //     await this.runtime.ensureRoomExists(roomId);
        //     await this.runtime.ensureParticipantInRoom(this.runtime.agentId, roomId);

        //     await this.runtime.messageManager.createMemory({
        //         id: stringToUuid(tweet.id + "-" + this.runtime.agentId),
        //         userId: this.runtime.agentId,
        //         agentId: this.runtime.agentId,
        //         content: {
        //             text: scalpIdea,
        //             url: tweet.permanentUrl,
        //             source: "twitter-scalping",
        //         },
        //         roomId,
        //         embedding: getEmbeddingZeroVector(),
        //         createdAt: tweet.timestamp,
        //     });

        //     elizaLogger.log(`Scalp idea posted and saved:\n ${tweet.permanentUrl}`);
        // } catch (error) {
        //     elizaLogger.error("Error posting scalp idea:", error);
        // }
    }
}

const getScalpIdea = async (runtime: IAgentRuntime, token: any) => {
    const priceChangeDirection = parseFloat(token.priceChangePercent) >= 0 ? '🔼' : '📉';
    const volume = parseFloat(token.quoteVolume).toLocaleString(undefined, {
        maximumFractionDigits: 2,
        notation: 'compact'
    });

    const tokenPerformanceTemplate = `
    # Task: Generate a casual, trading idea tweet in the voice of {{agentName}} (@{{twitterUserName}})

    Token Info:
    - Symbol: ${token.symbol}
    - Price: ${token.lastPrice}
    - 24h Change: ${token.priceChangePercent}%

    rules
    - Maximum 200 characters
    - pick only 1 timeframe, either 1h, 4h, 1d, 1w or 1m
    - never use emojis
    - dont include greetings or questions

    Guidelines:
    - Sometimes mention for meme coins
    - always break sentences in multiple lines
    - mention why you like the token
    - Don't make it sound too technical or formal
    - avoid hashtags
    - keep targets vague without numbers
    - dont include prices


    # Generate a casual scalping tweet:
    ` + messageCompletionFooter;

    // compose the message
    const context = composeContext({
        state: await runtime.composeState({
            agentId: runtime.agentId,
            userId: runtime.agentId,
            roomId: runtime.agentId,
            content: {
                text: `Analyzing ${token.symbol} at ${token.lastPrice} (${token.priceChangePercent}% ${priceChangeDirection})`
            }
        }),
        template: tokenPerformanceTemplate
    });

    const response = await generateMessageResponse({
        runtime,
        context,
        modelClass: ModelClass.MEDIUM
    });

    // return response without emojis or hashtags
    const cleanResponse = response.text.replace(/[\u2700-\u27BF]/g, '');
    // fix breaklines and addd new breaklines after periods
    const formattedTweet = cleanResponse
                .replaceAll(/\\n/g, "\n")
                // .replace(/(\.\s*)/g, "$1\n")
                .trim();

    // remove hashtags
    // const cleanTweet = formattedTweet.replace(/#\w+/g, '');

    return formattedTweet;
}
