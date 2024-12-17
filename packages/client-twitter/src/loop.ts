import { IAgentRuntime, elizaLogger, } from "@ai16z/eliza";
import { ClientBase } from "./base";


export class BaseLoopingClient {
    client: ClientBase;
    runtime: IAgentRuntime;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    private startLoop() {
        this.handleMainLoopBody();
        setTimeout(
            () => this.startLoop(),
            Number(this.runtime.getSetting("TWITTER_POLL_INTERVAL") ||  120) * 1000
        );
    }

    private async handleMainLoopBody() {
    }
}
