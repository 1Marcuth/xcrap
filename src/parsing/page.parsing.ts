import htmlParser, { HTMLElement } from "node-html-parser"

export type ResultData<T> = {
    [K in keyof T]: T[K] extends { fieldType: "multiple" }
        ? string[]
        : T[K] extends { model: infer NestedParsingModel }
        ? T[K] extends { isGroup: true }
            ? ResultData<NestedParsingModel>[]
            : ResultData<NestedParsingModel>
        : string
}

export type Extractor = (element: HTMLElement) => string

export type ParsingModelValueBase = {
    query?: string
    fieldType?: "single" | "multiple"
    extractor: Extractor
}

export type ParsingModelNestedValue = {
    query: string
    model: ParsingModel
    isGroup?: boolean
}

export type ParsingModelValue = ParsingModelValueBase | ParsingModelNestedValue

export type ParsingModel = {
    [key: string]: ParsingModelValueBase | ParsingModelNestedValue
}

export type ParseItemGroupOptions<ParsingModelType> = {
    query: string,
    model: ParsingModelType
    limit?: number
}

export type ParseItemOptions<ParsingModelType> = {
    query?: string
    model: ParsingModelType
}

export type ParseAllOptions = {
    query: string
    extractor: Extractor
    limit?: number
}

export type ParseOneOptions = {
    query?: string
    extractor: Extractor
}

class PageParser {
    public readonly source: string

    public constructor(source: string) {
        this.source = source
    }

    private processParsingModel<ParsingModelType extends ParsingModel>(element: HTMLElement, model: ParsingModelType): ResultData<ParsingModelType> {
        const data = {} as ResultData<ParsingModelType>
    
        for (const key in model) {
            const modelValue = model[key] as ParsingModelValue
    
            if ("extractor" in modelValue) {
                const { query, extractor, fieldType } = modelValue
    
                if (query) {
                    if (fieldType === "multiple") {
                        const nestedElements = element.querySelectorAll(query)
                        data[key as keyof ParsingModelType] = nestedElements.map(extractor) as any

                    } else {
                        const nestedElement = element.querySelector(query)

                        if (nestedElement) {
                            data[key as keyof ParsingModelType] = extractor(nestedElement) as any
                        } else {
                            data[key as keyof ParsingModelType] = "" as any
                        }
                    }
                } else {
                    data[key as keyof ParsingModelType] = extractor(element) as any
                }
            } else {
                const { model: nestedParsingModel, query, isGroup } = modelValue as ParsingModelNestedValue
                const nestedElements = element.querySelectorAll(query)

                if (isGroup) {
                    data[key as keyof ParsingModelType] = nestedElements.map(nestedElement => this.processParsingModel(nestedElement, nestedParsingModel)) as any
                } else {
                    const nestedElement = nestedElements[0]
                    data[key as keyof ParsingModelType] = nestedElement ? this.processParsingModel(nestedElement, nestedParsingModel) : {} as any
                }
            }
        }

        return data
    }

    public parseItemGroup<ParsingModelType extends ParsingModel>({
        query,
        model,
        limit
    }: ParseItemGroupOptions<ParsingModelType>): ResultData<ParsingModelType>[] {
        const document = htmlParser.parse(this.source)
        const items = document.querySelectorAll(query)

        let dataSet = items.map((item, index) => {
            if (limit != undefined && index >= limit) return
            const data = this.processParsingModel(item, model)
            return data
        }).filter(item => item !== undefined)

        if (limit != undefined && dataSet.length >= limit) {
            dataSet = dataSet.slice(0, limit)
        }

        return dataSet
    }

    public parseItem<ParsingModelType extends ParsingModel>({
        model,
        query
    }: ParseItemOptions<ParsingModelType>): ResultData<ParsingModelType> {
        let item: ResultData<ParsingModelType>

        if (query) {
            item = this.parseItemGroup({
                query: query,
                model: model,
                limit: 1
            })[0]
        } else {
            const document = htmlParser.parse(this.source)
            item = this.processParsingModel(document, model)
        }

        return item
    }

    public parseAll({
        query,
        extractor,
        limit
    }: ParseAllOptions): string[] {
        const document = htmlParser.parse(this.source)
        const elements = document.querySelectorAll(query)

        let dataSet: string[] = []

        for (const element of elements) {
            if (limit != undefined && dataSet.length >= limit) break
            const data = extractor(element)
            dataSet.push(data)
        }

        return dataSet
    }

    public parseOne({
        query,
        extractor
    }: ParseOneOptions): string {
        let data: string

        if (query) {
            data = this.parseAll({
                query: query,
                extractor: extractor,
                limit: 1
            })[0]
        } else {
            const document = htmlParser.parse(this.source)
            data = extractor(document)
        }

        return data
    }
}

export default PageParser