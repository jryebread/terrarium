import { KeyValueStore, PlaywrightCrawler, PuppeteerCrawler } from 'crawlee';
import OpenAI from 'openai';
import log from '@apify/log';
import { getElements, select } from './algo.js';
import {SELECT_SYS_PROMPT}  from './prompts.js'
const openai = new OpenAI({
  apiKey: "YOUR_API_KEY", // This is the default and can be omitted
});

// export async function generateTerms(searchQuery, websiteLink) {
//     const RETRIEVE_ELEMENTS_PROMPT = `
//     I am a blind person in need of assistance.
//     Generate 5 search terms that could be used to extract the information from the page to best match my search query. 
//     The terms should be ranked in order of estimated relevance to the search query.

//     DO NOT generate anything else except the search terms themselves separated by commas.

//     Example(1):

//     SearchQuery: Find the total land area of the Mojave Desert
//     Website to search: https://en.wikipedia.org/wiki/California
//     Answer: Mojave Desert area, Mojave land area, Mojave Desert, Mojave size, desert area

//     END EXAMPLE

//     Now your turn!

//     Search Query:${searchQuery}
//     Website to search: ${websiteLink}
//     Answer:
//     `
//     const chatCompletion = await openai.chat.completions.create({
//         messages: [{ role: 'user', content: RETRIEVE_ELEMENTS_PROMPT}],
//         model: 'gpt-4-1106-preview',
//         temperature: 0,
//     });

//     let content = chatCompletion.choices[0].message.content;
//     return content;
// }
function retnum(str) {
    // Use a regular expression to match the number inside parentheses
    const match = str.match(/\((\d+)\)/);

    // Check if a match is found
    if (match) {
        // Extract the matched number and parse it as an integer
        const num = parseInt(match[1], 10);
        return num;
    }

    // Return null if no match is found
    return null;
}

async function selectSingleElement(elements, searchQuery: string) {
    let elementsList = '';
    let count = 1;
    for (let i = 0; i < elements.length; i++) {
            elementsList += `${count}: '${elements[i]}'\n`;
            count++;
    }

    const fullPrompt = SELECT_SYS_PROMPT + '\n' + elementsList + '\n' + 'CURRENT GOAL: ' + searchQuery;
    log.info("DEBUG: " + fullPrompt)
    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'system', content: fullPrompt}],
        model: 'gpt-4-1106-preview',
        temperature: 0,
    });

    let content = chatCompletion.choices[0].message.content;

    const numb = retnum(content);
    if (numb == null) {
        log.error("OOPS!!!")
    }
    console.log("GOT NUM:" + content +   " " + numb + " " + elements[numb - 1]);

    return elements[numb - 1]; // to get the actual HTML element, index - 1 since the count is always i+1
}

let currResults = [];
let currAnswer = "";
const keyValueStore = await KeyValueStore.open();

export async function skadiSearch({terms, url, goal}){

    const crawler = new PlaywrightCrawler({
        requestHandler: async ({ page, request, enqueueLinks }) => {
            console.log(`Processing: ${request.url}`);

            let pageText = await getTextFromPage(page);
            let textAnswer = await getGPT4Answer(pageText, goal);
            console.log("Text Answer: " + textAnswer);
            currAnswer = textAnswer;

            let results = await getElements(page, terms, 10000);
            currResults = results;
            return results;
        },
        maxRequestsPerCrawl: 5,
    });

    await crawler.run([url])
    console.log("RESULTS: " + currResults);

    let singleElem = await selectSingleElement(currResults, goal);
    console.log("SINGLE: " + singleElem);

    return {
        elementCount: currResults.length,
        singleMostMatchingElement: singleElem,
        textAnswer: currAnswer,
        url: url
    };
}

async function getTextFromPage(page) {
    return await page.evaluate(() => document.body.innerText);
}

async function getGPT4Answer(text, goal) {
    const GPT4_PROMPT = `
    I am a blind person in need of assistance.
    Here is the text from the webpage:

    ${text}

    Based on this text, can you answer the following question?

    ${goal}
    `

    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: GPT4_PROMPT}],
        model: 'gpt-4-1106-preview',
        temperature: 0,
    });

    let content = chatCompletion.choices[0].message.content;
    return content;
}


// const r = await simpleSearch({
//     // terms: "IP Address, IP, networking", 
//     url: "https://en.wikipedia.org/wiki/Minecraft", 
//     goal: "how large was minecrafts launch?"
// });
// console.log(JSON.stringify(r));