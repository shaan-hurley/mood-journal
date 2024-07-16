import { OpenAI } from '@langchain/openai'
import { z } from 'zod'
import { StructuredOutputParser } from "langchain/output_parsers"
import { PromptTemplate } from '@langchain/core/prompts'
import { Document } from 'langchain/document'
import { loadQARefineChain } from 'langchain/chains'
import { OpenAIEmbeddings } from '@langchain/openai'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'

const parser = StructuredOutputParser.fromZodSchema(
    z.object({
        mood: z.string().describe('the mood of the person who wrote the journal entry.'),
        subject: z.string().describe('the subject of the journal entry.'),
        negative: z.boolean().describe('is the journal entry negative? (i.e. does it contain negative emotions?).'),
        summary: z.string().describe('quick summary of the entire entry.'),
        color: z.string().describe('a hexidecimal color code that represents the mood of the entry. Example #0101fe for blue representing happiness.'),
        sentimentScore: z.number().describe('sentiment of the text and rated on a scale from -10 to 10, where -10 is extremely negative, 0 is neutral, and 10 is extremely positive.')
    })
)

const getPrompt = async (content) => {
    const format_instructions = parser.getFormatInstructions()
    const prompt = new PromptTemplate({
        template: 'Analyze the following journal entry. Follow the instructions and format your response to match the format instructions, no matter what! \n {format_instructions}\n {entry}',
        inputVariables: ['entry'],
        partialVariables: { format_instructions }
    })

    const input = await prompt.format({ entry: content })

    return input
}

export const analyze = async (content) => {
    const input = await getPrompt(content)
    const model = new OpenAI({ model: 'gpt-3.5-turbo', temperature: 0, apiKey: process.env.OPEN_API_KEY })
    const result = await model.invoke(input)


    try {
        return parser.parse(result)
    } catch (e) {
        console.log(e)
    }
}


export const qa = async (question, entries) => {
    try {
        // Log the input parameters
        console.log('Question:', question)
        console.log('Entries:', entries)

        const docs = entries.map((entry) => {
            return new Document({
                pageContent: entry.content,
                metadata: {
                    id: entry.id,
                    createdAt: entry.createdAt
                }
            })
        })

        // Log the documents
        console.log('Documents:', docs)

        const model = new OpenAI({ model: 'gpt-3.5-turbo', temperature: 0, apiKey: process.env.OPEN_API_KEY })

        const chain = loadQARefineChain(model)

        const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPEN_API_KEY })

        // Create the memory vector store
        const store = await MemoryVectorStore.fromDocuments(docs, embeddings)
        // Log the vector store
        console.log('Vector store created')

        const relevantDocs = await store.similaritySearch(question)
        // Log the relevant documents
        console.log('Relevant documents:', relevantDocs)

        const res = await chain.invoke({
            input_documents: relevantDocs,
            question,
        })

        // Log the response
        console.log('Response:', res)

        return res.output_text
    } catch (error) {
        // Log the error
        console.error('Error in QA function:', error)
        throw new Error('Failed to process QA function')
    }
}