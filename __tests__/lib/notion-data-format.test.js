import getAllPageIds from '@/lib/db/notion/getAllPageIds'
import { adapterNotionBlockMap } from '@/lib/utils/notion.util'

jest.mock('p-limit', () => ({
  __esModule: true,
  default: jest.fn(() => fn => fn())
}))

jest.mock('@/lib/cache/cache_manager', () => ({
  getDataFromCache: jest.fn(),
  getOrSetDataWithCache: jest.fn(),
  setDataToCache: jest.fn()
}))

jest.mock('@/lib/db/notion/getNotionAPI', () => ({
  __esModule: true,
  default: {
    getPage: jest.fn(),
    getBlocks: jest.fn()
  }
}))

const { formatNotionBlock } = require('@/lib/db/notion/getPostBlocks')

describe('Notion data format compatibility', () => {
  it('unwraps nested block values returned by newer Notion payloads', () => {
    const blockMap = {
      block: {
        page_1: {
          spaceId: 'space_1',
          value: {
            role: 'editor',
            value: {
              id: 'page_1',
              type: 'page',
              properties: { title: [['Hello']] }
            }
          }
        }
      },
      collection: {}
    }

    const adapted = adapterNotionBlockMap(blockMap)

    expect(adapted.block.page_1.value).toMatchObject({
      id: 'page_1',
      type: 'page',
      properties: { title: [['Hello']] }
    })
  })

  it('extracts page ids from collection view page_sort in newer payloads', () => {
    const pageIds = getAllPageIds(
      {},
      'collection_1',
      {
        view_1: {
          value: {
            value: {
              page_sort: ['page_1', 'page_2']
            }
          }
        }
      },
      ['view_1'],
      {}
    )

    expect(pageIds).toEqual(['page_1', 'page_2'])
  })

  it('falls back to legacy collection query block ids', () => {
    const pageIds = getAllPageIds(
      {
        collection_1: {
          view_1: {
            collection_group_results: {
              blockIds: ['page_1']
            }
          },
          view_2: {
            blockIds: ['page_2']
          }
        }
      },
      'collection_1',
      {},
      ['view_1'],
      {}
    )

    expect(pageIds).toEqual(expect.arrayContaining(['page_1', 'page_2']))
  })

  it('normalizes nested blocks and strips crdt fields before rendering', () => {
    const formatted = formatNotionBlock({
      page_1: {
        value: {
          value: {
            id: 'page_1',
            type: 'image',
            crdt_data: { noisy: true },
            crdt_format_version: 1,
            properties: {
              source: [['https:example.com/image.png']]
            }
          },
          role: 'editor'
        }
      }
    })

    expect(formatted.page_1.value).toMatchObject({
      id: 'page_1',
      type: 'image'
    })
    expect(formatted.page_1.value.crdt_data).toBeUndefined()
    expect(formatted.page_1.value.crdt_format_version).toBeUndefined()
    expect(formatted.page_1.value.properties.source[0][0]).toBe(
      'https://example.com/image.png'
    )
  })
})
