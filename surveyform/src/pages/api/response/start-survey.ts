import gql from "graphql-tag";
import { getFragmentName } from "@vulcanjs/graphql";
import { CreateResponseOutputFragment } from "~/responses/fragments";
import type { NextApiRequest, NextApiResponse } from 'next'

import { serverConfig } from '~/config/server'
import { print } from 'graphql'
import { fetchSurvey } from "@devographics/core-models/server";
import { connectToAppDb } from "~/lib/server/mongoose/connection";
import { connectToRedis } from "~/lib/server/redis";

export default async function responseStartSurveyHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405)
    }
    await connectToAppDb()
    connectToRedis()

    const surveySlug = req.query["surveySlug"] as string
    if (!surveySlug) throw new Error("No survey slug, can't start survey")
    const surveyYear = req.query["surveyYear"] as string
    if (!surveyYear) throw new Error("No survey year, can't start survey")
    const survey = await fetchSurvey(surveySlug, surveyYear)


    // TODO: this code used to be a client-side graphql query
    // we reuse the same call temporarily to facilitate moving out of graphql
    try {
        const surveyCreateResponseOutputFragment =
            CreateResponseOutputFragment(survey);
        const mutation = gql`
            mutation startSurvey($input: CreateResponseInput) {
              startSurvey(input: $input) {
                ...${getFragmentName(surveyCreateResponseOutputFragment)}
              }
            }
            ${surveyCreateResponseOutputFragment}
        `;
        // TODO: this hack let's us call the existing graphql API until we rewrite the server without graphql
        const headers = {
            ...req.headers,
            "content-type": "application/json"
        }
        delete headers.connection
        delete headers["content-length"]

        const gqlRes = await fetch(serverConfig().appUrl + "/api/graphql", {
            method: "POST",
            // @ts-ignore
            headers,
            body: JSON.stringify(
                {
                    query: print(mutation),
                    variables: {
                        input: {
                            data: req.body
                        }
                    }
                }
            )
        })
        if (!gqlRes.ok) {
            console.error("Response text:", await gqlRes.text())
            throw new Error("Error during startSurvey")
        }
        const gqlJson: {
            data?: any,
            // graphql errors
            errors?: Array<{
                /** 
                 * For graphql errors in Vulcan, it is a stringified JSON object containing multiple errors
                 *@example [{"id":"app.validation_error","data":{"break":true,"errors":[{"break":true,"id":"error.duplicate_response","message":"Sorry, you already have a session in progress for this survey.","properties":{"responseId":"b_t8obuBh-z2ZvN6XiQH6"}}]}}]
                 * TODO: can it contain multiple errors?
                 */
                message: string
                path: Array<string>,
                extensions: any,
                locations: Array<{ column: number, line: number }>
            }>
        } = await gqlRes.json()
        console.log("startSurvey result", gqlJson)
        return res.status(200).json(gqlJson)
    } catch (err) {
        console.error("GraphQL fetch error", err)
        return res.status(500)
    }
}