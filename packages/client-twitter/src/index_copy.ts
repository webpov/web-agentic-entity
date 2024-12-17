import { TwitterPostClient } from "./post.ts";
import { TwitterSearchClient } from "./search.ts";
import { TwitterInteractionClient } from "./interactions.ts";
import { IAgentRuntime, Client, elizaLogger } from "@ai16z/eliza";
import { validateTwitterConfig } from "./environment.ts";
import { ClientBase } from "./base.ts";
import { TwitterDiscoveryClient } from "./discovery.ts";
import { ScalpingIdeaClient } from "./scalping.ts";

class TwitterManager {
    client: ClientBase;
    post: TwitterPostClient;
    search: TwitterSearchClient;
    scalping: ScalpingIdeaClient;
    interaction: TwitterInteractionClient;
    discovery: TwitterDiscoveryClient;
    constructor(runtime: IAgentRuntime) {
        this.client = new ClientBase(runtime);
        console.log("888888888 pre twitter post client");
        this.post = new TwitterPostClient(this.client, runtime);
        console.log("9999999999 Twitter manager constructor TwitterManager TwitterManager TwitterManager");

        this.discovery = new TwitterDiscoveryClient(this.client, runtime);
        // this.search = new TwitterSearchClient(runtime); // don't start the search client by default
        // this searches topics from character file, but kind of violates consent of random users
        // burns your rate limit and can get your account banned
        // use at your own risk
        this.scalping = new ScalpingIdeaClient(this.client, runtime);
        this.interaction = new TwitterInteractionClient(this.client, runtime);
    }
}

export const TwitterClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        await validateTwitterConfig(runtime);

        elizaLogger.log("Twitter client started **********");

        const manager = new TwitterManager(runtime);

        await manager.client.init();

        await manager.post?.start();

        await manager.interaction?.start();

        await manager.discovery?.start();

        await manager.scalping?.startLoop();

        return manager;
    },
    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("Twitter client does not support stopping yet");
    },
};

export default TwitterClientInterface;
