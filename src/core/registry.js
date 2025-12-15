// src/core/registry.js

window.BF_Registry = {
    plugins: [],
    tools: [],

    registerPlugin(pluginObj) {
        this.plugins.push(pluginObj);
        console.log(`BF_Registry: Plugin registered - ${pluginObj.name}`);
    },

    registerTool(toolObj) {
        this.tools.push(toolObj);
        console.log(`BF_Registry: Tool registered - ${toolObj.name}`);
    }
};

console.log('BF_Registry initialized');
