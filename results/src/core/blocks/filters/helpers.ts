import { useState, useEffect } from 'react'
import { getGraphQLQuery } from 'core/blocks/block/BlockData'
import { addNoAnswerBucket } from 'core/blocks/generic/VerticalBarBlock'
import { getCountryName } from 'core/helpers/countries'
import cloneDeep from 'lodash/cloneDeep.js'
import isEmpty from 'lodash/isEmpty'
import { CustomizationDefinition, CustomizationOptions } from './types'
import { BlockDefinition } from 'core/types'
import {
    MODE_DEFAULT,
    MODE_FACET,
    MODE_GRID,
    MODE_COMBINED,
    START_MARKER,
    END_MARKER
} from './constants'
import { useI18n } from 'core/i18n/i18nContext'
import { useTheme } from 'styled-components'
import round from 'lodash/round'
import { useAllChartsOptions, getVariantBarColorItem } from 'core/charts/hooks'
import sumBy from 'lodash/sumBy'
import roundBy from 'lodash/roundBy'
import { usePageContext } from 'core/helpers/pageContext'
import { CustomizationFiltersCondition } from './types'
import { getBlockLink } from 'core/helpers/blockHelpers'

export const getNewCondition = ({ filtersNotInUse, keys }) => {
    const field = filtersNotInUse[0]
    return { field, operator: 'eq', value: keys?.[field]?.[0] }
}

export const getNewSeries = ({ filters, keys, year }) => {
    const filtersNotInUse = filters
    return { year, conditions: [getNewCondition({ filtersNotInUse, keys })] }
}

/*

Get a series' name based on its filters

NOT USED

*/
const getSeriesName = ({
    block,
    year,
    conditions
}: {
    block: BlockDefinition
    year: number
    conditions: CustomizationFiltersCondition
}) => {
    const suffix = conditions.map(
        ({ field, operator, value }) => `${field}__${operator}__${value.toString()}`
    )
    return `${block.id}___${year}___${suffix}`
}

/*

Generate query used for filtering

*/
export const getFiltersQuery = ({
    block,
    chartFilters = { options: {} },
    currentYear
}: {
    block: BlockDefinition
    chartFilters: CustomizationDefinition
    currentYear: number
}) => {
    const { options = {}, filters, facet } = chartFilters
    const { enableYearSelect, mode } = options
    let queryBody
    const query = getGraphQLQuery(block)
    const queryHeader = query.slice(0, query.indexOf(START_MARKER))
    const queryFragment = query.slice(
        query.indexOf(START_MARKER) + START_MARKER.length,
        query.indexOf(END_MARKER)
    )

    const seriesNames: string[] = []

    const cleanUpValue = s => s.replaceAll('-', '_')

    const queryFooter = query.slice(query.indexOf(END_MARKER) + END_MARKER.length)

    if (mode === MODE_GRID || mode === MODE_COMBINED) {
        queryBody = filters
            .map((singleSeries, seriesIndex) => {
                // {gender: {eq: male}, company_size: {eq: range_1}}
                const filtersObject = {}
                singleSeries.conditions.forEach(condition => {
                    const { field, operator, value } = condition
                    // transform e.g. es-ES into es_ES
                    const cleanValue = Array.isArray(value)
                        ? value.map(cleanUpValue)
                        : cleanUpValue(value)
                    filtersObject[field] = { [operator]: cleanValue }
                })
                const seriesName = `${block.id}_${seriesIndex + 1}`
                seriesNames.push(seriesName)
                let seriesFragment = queryFragment
                    .replace(`${block.id}: `, `${seriesName}: `)
                    .replace(
                        'filters: {}',
                        `filters: ${JSON.stringify(filtersObject).replaceAll('"', '')}`
                    )
                if (enableYearSelect && singleSeries.year) {
                    seriesFragment = seriesFragment.replace(
                        `year: ${currentYear}`,
                        `year: ${singleSeries.year}`
                    )
                }
                return seriesFragment
            })
            .join('')
    } else if (mode === MODE_FACET) {
        queryBody = queryFragment.replace('facet: null', `facet: ${facet}`)

        if (block?.variables?.fixedIds) {
            /*

            Because facets are obtained in a "reversed" structure from the API, in some cases
            (e.g. countries) we need to fix the ids to ensure each facet contains the same items. 
            
            TODO: return proper structure from API and delete this step

            */
            const fixedIdsFilter = `{ ids: { in: [${block?.variables?.fixedIds
                .map(id => `"${id}"`)
                .join()}] } }`
            queryBody = queryBody.replace('filters: {}', `filters: ${fixedIdsFilter}`)
        }
    }
    const newQuery = queryHeader + queryBody + queryFooter

    // console.log(newQuery)
    return { query: newQuery, seriesNames }
}

const baseUnits = ['count', 'percentage_question', 'percentage_survey']

/*

Take multiple buckets arrays and merge them into a array with
multiple series (e.g. { count, count_1, percentage_question, percentage_question_1, etc. })

*/
export const combineBuckets = ({ defaultBuckets, otherBucketsArrays, completion }) => {
    const mergedBuckets = cloneDeep(defaultBuckets)
    otherBucketsArrays.forEach((buckets = [], index) => {
        // default series is series 0, first custom series is series 1, etc.
        const seriesIndex = index + 1
        // TODO: add this later
        // const bucketsWithNoAnswerBucket = addNoAnswerBucket({ buckets, completion })
        mergedBuckets.forEach(bucket => {
            const { id } = bucket
            const otherSeriesBucket = buckets.find(b => b.id === id)
            if (otherSeriesBucket) {
                baseUnits.forEach(field => {
                    bucket[`${field}__${seriesIndex}`] = otherSeriesBucket[field]
                })
            } else {
                // series might have returned undefined;
                // or else default buckets contains bucket items not in series buckets
                baseUnits.forEach(field => {
                    bucket[`${field}__${seriesIndex}`] = 0
                })
            }
        })
    })
    return mergedBuckets
}

/*

Take an array of facets of the shape:

facets: [
    {
        id: "male"
        buckets: [
            {
                id: "syntaxfm",
                count: 1234,
                // ...
            },
            {
                id: "jsparty",
                count: 1234,
                // ...
            },
            // ...
        ]
    },
    {
        id: "female"
        buckets: [
            {
                id: "syntaxfm",
                count: 1234,
                // ...
            },
            {
                id: "jsparty",
                count: 1234,
                // ...
            },
            // ...
        ]
    }
]

And "invert" it into:

buckets: [
    {
        id: "syntaxfm",
        count: 1234,
        count__male: 923
        count__female: 123
        // ...
    },
    {
        id: "jsparty",
        count: 1234,
        count__male: 923
        count__female: 123
        // ...
    },
    // ...
]

NOTE: this could be avoided by inverting the API query itself

*/
export const invertFacets = ({ facets, defaultBuckets }) => {
    const newBuckets = cloneDeep(defaultBuckets)
    facets.forEach(facet => {
        facet.buckets.forEach(facetBucket => {
            const baseBucket = newBuckets.find(b => b.id === facetBucket.id)
            if (!baseBucket) {
                console.warn(
                    `Could not find bucket id ${facetBucket.id} while processing facet id ${facet.id}`
                )
                console.warn(facetBucket)
                return
            }
            baseUnits.forEach(field => {
                baseBucket[`${field}__${facet.id}`] = facetBucket[field]
            })
            baseBucket[`percentage_bucket__${facet.id}`] = round(
                (facetBucket.count * 100) / baseBucket.count,
                2
            )
        })
    })
    return newBuckets
}

/*

Calculate facet averages

*/
export const calculateAverages = ({ buckets, facet, allChartsOptions }) => {
    const facetOptions = allChartsOptions[facet]
    if (facetOptions && typeof facetOptions[0].average !== 'undefined') {
        buckets.forEach(bucket => {
            if (bucket.id === 'no_answer') {
                bucket.average = 0
                return
            }
            const averageValue =
                sumBy(facetOptions, ({ id, average }) => {
                    const facetCount = bucket[`count__${id}`] || 0
                    return average * facetCount
                }) / bucket.count
            bucket.average = Math.round(averageValue)
        })
    }
    return buckets
}

/*

Get label for field

*/
export const getFieldLabel = ({ getString, field }) => getString(`user_info.${field}`)?.t

/*

Get label for operator

*/
export const getOperatorLabel = ({ getString, operator }) =>
    getString(`filters.operators.${operator}`, {}, operator)?.t

/*

Get label for a field value (age range, country name, source name, locale label, etc.)

*/
export const getValueLabel = ({ getString, field, value, allChartsOptions }) => {
    switch (field) {
        case 'country': {
            return getCountryName(value) || value
        }
        case 'source': {
            const source = allChartsOptions.source.find(s => s.id === value)
            return source?.entity?.name || value
        }
        case 'locale': {
            const locale = allChartsOptions.locale.find(l => l.id === value)
            const fallback = locale.label
            return getString(`options.${field}.${value}`, {}, fallback)?.t
        }
        default: {
            const fallback = value
            return getString(`options.${field}.${value}`, {}, fallback)?.t
        }
    }
}

/*

Generate the legends used when filtering is enabled

*/
export const useFilterLegends = (props: { chartFilters: any }) => {
    const context = usePageContext()
    const { currentEdition } = context
    const { year: currentYear } = currentEdition

    const { chartFilters } = props
    const { options } = chartFilters
    const { showDefaultSeries, mode } = options

    const reverse = mode === MODE_FACET

    const allChartsOptions = useAllChartsOptions()
    const theme = useTheme()
    const { colors } = theme
    const { getString } = useI18n()
    let results
    if (chartFilters.options.mode === MODE_GRID || chartFilters.options.mode === MODE_COMBINED) {
        if (!chartFilters.filters || chartFilters.filters.length === 0) {
            return []
        } else {
            const showYears =
                chartFilters.options.enableYearSelect &&
                chartFilters.filters.some(s => s.year && s.year !== currentYear)

            const defaultLabel = showYears
                ? getString('filters.series.year', { values: { year: currentYear } })?.t
                : getString('filters.legend.default')?.t
            const defaultLegendItem = {
                color: colors.barColorDefault.color,
                gradientColors: colors.barColorDefault.gradient,
                id: 'default',
                label: defaultLabel,
                shortLabel: defaultLabel
            }

            const seriesLegendItems = chartFilters.filters.map((seriesItem, seriesIndex) => {
                let labelSegments = []
                if (showYears) {
                    // if at least one series is showing a different year, add year to legend
                    labelSegments.push(
                        getString('filters.series.year', { values: { year: seriesItem.year } })?.t
                    )
                }
                if (seriesItem.conditions.length > 0) {
                    // add conditions filters to legend
                    labelSegments = [
                        ...labelSegments,
                        seriesItem.conditions.map(({ field, operator, value }) => {
                            const fieldLabel = getFieldLabel({ getString, field })
                            const operatorLabel = getOperatorLabel({ getString, operator })
                            const valueArray = Array.isArray(value) ? value : [value]
                            const valueLabel = valueArray
                                .map(valueString =>
                                    getValueLabel({
                                        getString,
                                        field,
                                        value: valueString,
                                        allChartsOptions
                                    })
                                )
                                .join(', ')
                            return `${fieldLabel} ${operatorLabel} ${valueLabel}`
                        })
                    ]
                }
                const label = labelSegments.join(', ')

                const barColorItem = getVariantBarColorItem(colors, seriesIndex, null)

                const legendItem = {
                    color: barColorItem.color,
                    gradientColors: barColorItem.gradient,
                    id: `series_${seriesIndex + 1}`,
                    label,
                    shortLabel: label
                }
                return legendItem
            })
            results = [...(showDefaultSeries ? [defaultLegendItem] : []), ...seriesLegendItems]
        }
    } else if (chartFilters.options.mode === MODE_FACET) {
        results = allChartsOptions[chartFilters.facet].map(({ id }, index) => {
            const label = getValueLabel({
                getString,
                field: chartFilters.facet,
                value: id,
                allChartsOptions
            })
            const barColorItem = getVariantBarColorItem(colors, index + 1, chartFilters.facet)
            return {
                color: barColorItem.color,
                gradientColors: barColorItem.gradient,
                id: `series_${id}`,
                label,
                shortLabel: label
            }
        })
    } else {
        results = []
    }
    return reverse ? [...results].reverse() : results
}

/*

Initialize the chart customization filter state

*/
export const getInitFilters = (initOptions: CustomizationOptions): CustomizationDefinition => ({
    options: {
        showDefaultSeries: true,
        enableYearSelect: true,
        mode: MODE_DEFAULT,
        queryOnLoad: false,
        ...initOptions
    },
    filters: []
})

/*

Hook to initialize chart filters

*/
export const useChartFilters = ({
    block,
    options
}: {
    block: BlockDefinition
    options: CustomizationOptions
}) => {

    let loadFiltersFromUrl = false, urlFilters = {}
    if (typeof location !== 'undefined') {
        const search = new URLSearchParams(location.search)
        const queryParams = Object.fromEntries(search.entries())
        urlFilters = queryParams.filters && JSON.parse(atob(queryParams.filters))
        loadFiltersFromUrl = urlFilters && block.id === queryParams.blockId
    }

    // contains the filters that define the series
    const [chartFilters, setChartFilters] = useState(
        loadFiltersFromUrl ? { ...urlFilters, queryOnLoad: true } : getInitFilters(options)
    )

    const legends = useFilterLegends({
        chartFilters
    })
    return { chartFilters, setChartFilters, legends }
}

/*

Persist state in localStorage

https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/

 */
export function useStickyState(defaultValue: any, key: string) {
    const [value, setValue] = useState(() => {
        const stickyValue = window.localStorage.getItem(key)
        return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue
    })
    useEffect(() => {
        window.localStorage.setItem(key, JSON.stringify(value))
    }, [key, value])
    return [value, setValue]
}

export const getFiltersLink = ({
    block,
    context,
    filtersState
}: {
    block: BlockDefinition
    context: any
    filtersState: any
}) => {
    const encodedParams = btoa(JSON.stringify(filtersState))
    const params = { filters: encodedParams, blockId: block.id }
    const link = getBlockLink({ block, context, params, useRedirect: false })
    return link
}
