import { TwitterPostClient } from "./post.ts";
import { TwitterSearchClient } from "./search.ts";
import { TwitterInteractionClient } from "./interactions.ts";
import { IAgentRuntime, Client, elizaLogger } from "@ai16z/eliza";
import { validateTwitterConfig } from "./environment.ts";
import { ClientBase } from "./base.ts";
import { TwitterDiscoveryClient } from "./discovery.ts";
import { ScalpingIdeaClient } from "./scalping.ts";
import { TwitterLikeClient } from "./like.ts";
import { Context, Telegraf } from "telegraf";
import { MessageManager } from "./messageManager.ts";
import { CryptoTrendingClient } from "./trending.ts";

class TwitterManager {
    client: ClientBase;
    post: TwitterPostClient;
    search: TwitterSearchClient;
    scalping: ScalpingIdeaClient;
    like: TwitterLikeClient;
    interaction: TwitterInteractionClient;
    private messageManager: MessageManager;
    discovery: TwitterDiscoveryClient;
    trending: CryptoTrendingClient;
    tg_bot: Telegraf<Context>;
    constructor(runtime: IAgentRuntime, botToken: string) {
        // every 66 mins trending coin analysis
        // every 55 mins retweet own recent post
        // every 44 mins post about coin scalp idea
        // every 33 mins comment on a random post
        // every 22 mins like a random post
        // every 11 mins reply to mentions
        this.tg_bot = new Telegraf(botToken);
        elizaLogger.log("starting crypto trending client 99 mins");
        this.trending = new CryptoTrendingClient(runtime, this.tg_bot);
        this.messageManager = new MessageManager(this.tg_bot, runtime);
        elizaLogger.log("starting twitter scalping client 66 mins");
        this.scalping = new ScalpingIdeaClient(this.client, runtime, this.tg_bot); 
        elizaLogger.log("starting twitter post client every 44 mins");
        this.post = new TwitterPostClient(this.client, runtime, this.tg_bot); 





        // this.client = new ClientBase(runtime);
        // twitter clients
        // elizaLogger.log("starting twitter discovery client");
        // this.discovery = new TwitterDiscoveryClient(this.client, runtime); // every 33 mins comment on a random post
        // elizaLogger.log("starting twitter like client");
        // this.like = new TwitterLikeClient(this.client, runtime); // every 22 mins like a random post
        // elizaLogger.log("starting twitter interaction client");
        // this.interaction = new TwitterInteractionClient(this.client, runtime); // every 11 mins reply to own post

        // this.search = new TwitterSearchClient(runtime); // don't start the search client by default
        // this searches topics from character file, but kind of violates consent of random users
        // burns your rate limit and can get your account banned
        // use at your own risk
    }
}

export const TwitterClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        await validateTwitterConfig(runtime);

        elizaLogger.log("Twitter client started **********");

        const manager = new TwitterManager(runtime, runtime.getSetting("TELEGRAM_BOT_TOKEN"));

        await manager.client?.init();

        await manager.post?.start();

        await manager.interaction?.start();

        await manager.discovery?.start();

        await manager.like?.start();

        await manager.scalping?.startLoop();

        await manager.trending?.start();

        return manager;
    },
    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("Twitter client does not support stopping yet");
    },
};

export default TwitterClientInterface;
