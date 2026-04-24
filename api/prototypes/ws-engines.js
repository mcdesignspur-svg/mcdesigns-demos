import {
    contextAgent,
    strategistAgent,
    copyAgent,
    visualAgent,
    qaAgent,
} from './ws-agents.js';

export function getWestsideEngine() {
    const engine = process.env.WESTSIDE_AGENT_ENGINE || 'direct';
    if (engine === 'managed') return managedAgentsEngine;
    return directClaudeEngine;
}

const directClaudeEngine = {
    name: 'direct',
    async generate({ input, run, feedback = [] }) {
        const { location } = input;

        const { context, strategy } = await run('strategist', async () => {
            const context = await contextAgent({ location });
            const strategy = await strategistAgent({ context, input, feedback });
            return { context, strategy };
        });

        const { copy, visual } = await run('copy', async () => {
            const copy = await copyAgent({ context, strategy, input, feedback });
            const visual = await visualAgent({ context, strategy, copy, input });
            return { copy, visual };
        });

        const qa = await run('qa', () => qaAgent({ copy, visual, strategy }));

        return {
            output: composeOutput({ context, strategy, copy, visual, qa }),
            raw: { context, strategy, copy, visual, qa },
        };
    },
};

const managedAgentsEngine = {
    name: 'managed',
    async generate() {
        assertManagedAgentsConfig();

        throw new Error(
            'Managed Agents adapter is configured but not implemented yet. ' +
            'Keep WESTSIDE_AGENT_ENGINE=direct until the Managed Agents API client is wired.'
        );
    },
};

function assertManagedAgentsConfig() {
    const required = [
        'WESTSIDE_STRATEGY_AGENT_ID',
        'WESTSIDE_COPY_AGENT_ID',
        'WESTSIDE_QA_AGENT_ID',
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
        throw new Error(`Missing Managed Agents env vars: ${missing.join(', ')}`);
    }
}

function composeOutput({ context, strategy, copy, visual, qa }) {
    return {
        ...copy,
        image_prompt: visual.image_prompt,
        shoot_references: visual.shoot_references,
        suggested_visual_beat: visual.suggested_visual_beat,
        best_time: context.best_time || null,
        strategy,
        qa,
    };
}

