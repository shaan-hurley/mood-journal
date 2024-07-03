import { OpenAI } from '@langchain/openai'

export const analyze = async (prompt) => {
    const model = new OpenAI({model: 'gpt-3.5-turbo-instruct', temperature: 0, apiKey: process.env.OPEN_API_KEY})
    const result = await model.invoke(prompt)
    console.log({result});
    console.log("api key:", process.env.OPEN_API_KEY)
}