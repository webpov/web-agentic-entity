import {
    composeContext,
    generateMessageResponse,
    messageCompletionFooter,
    ModelClass,
    IAgentRuntime,
    stringToUuid,
    elizaLogger,
    getEmbeddingZeroVector,
} from "@ai16z/eliza";
import { Context, Telegraf } from "telegraf";
// Import the default trending data
import defaultTrendingData from './trending.json';

interface TrendingCoin {
    item: {
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number;
        price_btc: number;
        score: number;
        data: {
            price: number;
            price_change_percentage_24h: {
                [key: string]: number;
            };
            market_cap: string;
            total_volume: string;
            content?: {
                title?: string;
                description?: string;
            };
        };
    };
}

interface TrendingResponse {
    coins: TrendingCoin[];
}

const trendingAnalysisTemplate = (coinData: string) => `
# Task: Analyze trending cryptocurrency data and generate insights

Trending Coin Data:
${coinData}

# Guidelines:
- no introductions
- Focus on significant price movements and volume
- Mention market sentiment if relevant
- Keep analysis concise and informative
- Include only relevant market cap 
- Highlight any notable project developments

# Generate a market analysis for these trending coins:
` + messageCompletionFooter;

const MAX_MESSAGE_LENGTH = 280; // Telegram's message length limit

export class CryptoTrendingClient {
    runtime: IAgentRuntime;
    tg_bot: Telegraf<Context>;

    constructor(runtime: IAgentRuntime, tg_bot: Telegraf<Context>) {
        this.runtime = runtime;
        this.tg_bot = tg_bot;
    }

    async start() {
        elizaLogger.log("TRENDING: Crypto trending client ready, starting handleTrendingLoop");
        this.handleTrendingLoop();
    }

    private handleTrendingLoop() {
        this.handleTrending();
        setTimeout(
            () => this.handleTrendingLoop(),
            Number(3960) * 1000 // 66 minutes
        );
    }

    private async handleTrending() {
        elizaLogger.log("TRENDING: Processing trending cryptocurrencies");

        try {
            let data: TrendingResponse;
            
            // Use default data in development/testing
            if (true) {
                elizaLogger.log("TRENDING: Fetching live trending data");
                const apiResponse = await fetch('https://api.coingecko.com/api/v3/search/trending');
                data = await apiResponse.json();
            } else {
                elizaLogger.log("TRENDING: Using default trending data");
                data = defaultTrendingData as TrendingResponse;
            }

            console.log("datadatadatadata", data.coins[0].item.data);
            // include only 3 coins under 5 billion market cap
            const selectedCoins =  data.coins
            .filter((coin:any) => parseFloat(coin.item.data.market_cap_btc) < 40000)
            // .slice(0, 3)
            .sort(() => 0.5 - Math.random()).slice(0, 3)
            console.log("selectedCoins", selectedCoins);
            const formattedCoins = selectedCoins
            .map(coin => {
                const item = coin.item;
                return `
Coin: ${item.name} (${item.symbol.toUpperCase()})
Rank: #${item.market_cap_rank}
Price: $${item.data.price.toFixed(4)}
24h Change: ${item.data.price_change_percentage_24h?.usd?.toFixed(2)}%
Market Cap: ${item.data.market_cap}
Volume: ${item.data.total_volume}
${item.data.content?.description ? `Description: ${item.data.content.description}` : ''}
`;
            }).join('\n---\n');



            const state = await this.runtime.composeState({
                agentId: this.runtime.agentId,
                userId: this.runtime.agentId,
                roomId: this.runtime.agentId,
                content: { text: formattedCoins }
            });

            const context = composeContext({
                state,
                template: trendingAnalysisTemplate(formattedCoins)
            });

            const aiResponse = await generateMessageResponse({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.MEDIUM,
            });

            if (aiResponse.text) {
                try {
                    if (this.runtime.getSetting("DRY_RUN") === "true") {
                        elizaLogger.info(`TRENDING: Dry run: would have sent to Telegram: ${aiResponse.text}`);
                        return;
                    }

                    // Split message if it exceeds Telegram's limit
                    const messages = this.splitMessage(aiResponse.text);
                    const channelId = this.runtime.getSetting("TELEGRAM_CHANNEL_ID");

                    elizaLogger.log("TRENDING: sending message(s) to telegram " + channelId);
                    
                    // Send each message chunk
                    for (const message of messages) {
                        await this.tg_bot.telegram.sendMessage(channelId, message);
                    }

                    // Save as memory
                    const roomId = stringToUuid(`trending-room-${this.runtime.agentId}`);

                    await this.runtime.ensureRoomExists(roomId);
                    await this.runtime.ensureParticipantInRoom(this.runtime.agentId, roomId);

                    const memoryToSave = {
                        id: stringToUuid(`telegram-${Date.now()}-${this.runtime.agentId}`),
                        userId: this.runtime.agentId,
                        agentId: this.runtime.agentId,
                        content: {
                            text: aiResponse.text,
                            source: "telegram-crypto-trending",
                            action: aiResponse.action
                        },
                        roomId,
                        embedding: getEmbeddingZeroVector(),
                        createdAt: Date.now(),
                    };

                    await this.runtime.messageManager.createMemory(memoryToSave);

                    // Cache analysis
                    const analysisInfo = `Context:\n\n${context}\n\nAgent's Analysis:\n${aiResponse.text}`;
                    await this.runtime.cacheManager.set(
                        `telegram/crypto_trending_${Date.now()}.txt`,
                        analysisInfo
                    );

                } catch (error) {
                    elizaLogger.error(`TRENDING: Error sending telegram message: ${error}`);
                }
            }

        } catch (error) {
            elizaLogger.error("TRENDING: Error processing trending data:", error);
        }
    }

    private splitMessage(text: string): string[] {
        if (text.length <= MAX_MESSAGE_LENGTH) {
            return [text];
        }

        const messages: string[] = [];
        let currentMessage = "";

        // Split on newlines to preserve formatting
        const lines = text.split('\n');

        for (const line of lines) {
            if ((currentMessage + line + '\n').length > MAX_MESSAGE_LENGTH) {
                if (currentMessage) {
                    messages.push(currentMessage.trim());
                    currentMessage = "";
                }
                
                // If a single line is too long, split it
                if (line.length > MAX_MESSAGE_LENGTH) {
                    const chunks = line.match(new RegExp(`.{1,${MAX_MESSAGE_LENGTH}}`, 'g')) || [];
                    messages.push(...chunks);
                    continue;
                }
            }
            currentMessage += line + '\n';
        }

        if (currentMessage) {
            messages.push(currentMessage.trim());
        }

        return messages;
    }
}
