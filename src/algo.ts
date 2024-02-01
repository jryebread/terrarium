import { encoding_for_model } from "@dqbd/tiktoken";
import { log } from "console";

function tokenCount(message: string) {
  const encoder = encoding_for_model("gpt-3.5-turbo");

  const tokens = encoder.encode(message);
  encoder.free();
  return tokens.length;
}

const findMatchingElements = ({ term, parentCount }) => {
  let results = [];
  let regex = new RegExp(term, 'i'); 

  document.querySelectorAll('*').forEach((el) => {
      if (regex.test(el.textContent)) { 
          let target = Array.from(el.querySelectorAll('*')).reverse().find((child) => regex.test(child.textContent));
          target = target || el; 

          // If parentCount is not 0, move up the DOM tree
          while (parentCount > 0 && target.parentElement) {
              target = target.parentElement;
              parentCount--;
          }

          results.push(target.outerHTML);
      }
  });

  return results;
};

export const getElements = async (page, terms, tokenLimit) => {
  let matchingElements = [];
  let tokenUsage = 0;
  let finalList = new Set(); // Use a Set to avoid duplicates

  const searchInputs = terms.split(',')

  // STEP ONE: get all matching elements for each term concurrently
  const promises = searchInputs.map(term => page.evaluate(findMatchingElements, { term, parentCount: 1}));
  matchingElements = await Promise.all(promises);

  console.log("matchingElem: ")
  console.log(matchingElements)

  // populate a final list, favoring earlier terms
  for (const elements of matchingElements) {
      for (const el of elements) {
          const elTokenCount = tokenCount(el); 

          // If the element fits, add it
          if (tokenUsage + elTokenCount <= tokenLimit) {
              tokenUsage += elTokenCount;
              finalList.add(el); 
            } else {
              // If the element doesn't fit, break out of the loop
              break;
          }
      }

      // If we've hit the token limit, break out of the loop
      if (tokenUsage >= tokenLimit) {
          break;
      }
  }
  console.log("SIZE F" + finalList.size)
  return Array.from(finalList); // Convert the Set back to an Array before returning
};
  