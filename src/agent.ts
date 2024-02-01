
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import {
    DynamicStructuredTool,
} from "@langchain/community/tools/dynamic";
import { z } from "zod";

import { simpleSearch, skadiSearch } from "./main.js"
import { MessagesPlaceholder, SystemMessagePromptTemplate } from "langchain/prompts";

const llm = new ChatOpenAI({
    modelName: "gpt-4-1106-preview",
    temperature: 0,
    openAIApiKey: "INSERT_YOUR_API_KEY"
  });
  
//get the most single relevant elem and the quantity of matching elements for each search term
//this info helps our agent decide whether or not to try again with diff search terms
const searchQuery = "cost of all plans"
const webLink = "https://www.clay.com"

const tools = [
    new DynamicStructuredTool({
      name: "GET_ELEMENT",
      schema: z.object({
        terms: z.string().describe("list of terms to search through the website URL to find our goal. should be separated by commas"),
        url: z.string().describe("The URL to search on, this URL can be one that you found searching the initial provided URL"),
        goal: z.string().describe("The search query ultimate goal")
      }),
      description: 
      `Use this tool to select most relevant element to the input terms, url, and most importantly, search goal. 
      input format: 
      terms - list of strings
      url - string
      goal - string
      
      returns a json of the count of matching elements, single most matching HTML element, and the text from the current page for you to find the answer to the goal.`,
      func: async ({terms, url, goal}) => {
        const result = await skadiSearch({
            terms: terms, 
            url: url, 
            goal: goal
        });
        return JSON.stringify(result);  
      }
    }),
]

const message = SystemMessagePromptTemplate.fromTemplate(`

Use the following format:

Thought: you should always think about what to do
Action: the action to take
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question taken from the given website. This should be the HTML element
you have been returned from the tool that contains the answer.

Note: The GET_ELEMENT tool will help identify HTML elements on the current page that are relevant to a given goal and to help you answer the users query. 
You should provide to it: 
- 5 terms, ranked in order of specificity, a string that is a list of terms separated by commas. They don't have to be full words, you can use anything you think will match, even symbols in case you're looking for pricing, can try $.
- the webpage url you'd like to search for elements on (it can be any URL, either the original or one that is found on the page that likely leads to the answer), string called url
- a goal describing what we are looking for on this page, string called goal
An HTML parser will search the page for elements whose innerText match any of the search terms (case-insensitive), and include the element that is most relevant to the goal in its return value. Your search terms do not need to include complete words, and can be as short as a few letters. 
The full return value of this tools function will include: 
- the number of matches found for each search term you provided 
- the most relevant element extracted from the original page 
- A reminder of the URL where this element can be found 

Remember, you can use the GET_ELEMENT tool to search any URLs you find on the original page if you think they might lead to the answer. Begin!

You are an agent whose task is to answer the users question, or return a link on the page that is more likely to have the answer:  
- {input}
  
using the tools available to you and the information from the given website: 
- {url} 

Thoughts: `);

const prompt = ChatPromptTemplate.fromMessages([message,  
  new MessagesPlaceholder("agent_scratchpad")],
);

const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
});

const executor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    verbose: true,
    maxIterations: 5,
  });
  
const result = await executor.invoke({
    input: searchQuery,
    url: webLink,
    tools: tools
});

console.log(result);