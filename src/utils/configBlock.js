import { whitespace, beginningOfStringOrNewline, newline, newlineCharacters } from './regexes.js'

const flag = ` ?\\+(?<flag_name>[^ ${newlineCharacters}-+]+)`
const flags = `(${flag})+`;
const blockItem = `${whitespace}*\\- (?<item_name>[^:]+): (?<item_value>[^${newlineCharacters}]+?)(?<item_flags>${flags})?${newline}+`
const blockItems = `${newline}+(${blockItem})+`
const itemBlockRegex = (name = '[^:]+') => `${beginningOfStringOrNewline}(?<block>#* ?\\*{0,2}(?<block_name>${name}):?\\*{0,2}:?(?<block_items>${blockItems}))`

const getBlock = (body, blockName) => {
  const blockMatch = body.match(new RegExp(itemBlockRegex(blockName)))
  return blockMatch && {
    name: blockMatch.groups.block_name,
    items: blockMatch.groups.block_items,
  }
}

export const getItems = (body, blockName, filter = () => true) => {
  const block = getBlock(body, blockName)

  if (!block) {
    return null
  }

  return block.items.match(new RegExp(blockItem, 'g'))
    .map(itemText => {
      const {groups: {item_name, item_value, item_flags}} = itemText.match(new RegExp(blockItem))
      return {
        name: item_name,
        value: item_value,
        flags: item_flags === undefined ? [] : item_flags.match(new RegExp(flag, 'g'))
          .map(flagText => flagText.match(new RegExp(flag)).groups.flag_name)
      }
    })
    .map(item => item.flags.includes('csv') ? {
      ...item,
      value: item.value.split(new RegExp(', *')),
      flags: item.flags.filter(flag => flag !== 'csv')
    } : item)
    .filter(filter)
    .reduce((result, {name, value, flags}) => ({...result, [name]: {value, flags}}), {})
}

export const getItemValue = (body, blockName, itemName) => {
  const items = getItems(body, blockName)
  return items && items[itemName] ? items[itemName].value : undefined;
}

export const setItems = (body, blockName, newItems) => {
  const block = getBlock(body, blockName);

  const renderFlags = (flags) => flags
    ? flags.map(flag => ` +${flag}`).join('')
    : ``

  const renderTextItem = (name, {flags, value}) =>
    `- ${name}: ${value}${renderFlags(flags)}\n`

  const renderCsvItem = (name, {flags, value}) =>
    `- ${name}: ${value.join(', ')}${renderFlags([...flags, 'csv'])}\n`

  const renderItem = (name, {flags, value}) => {
    switch(true) {
      case typeof(value) === 'string':
        return renderTextItem(name, {flags, value})
      case value instanceof Array:
        return renderCsvItem(name, {flags, value})
      default:
        throw new Error(`unsupported value type ${typeof value}: ${JSON.stringify(value)}`);
    }
  }

  const newItemsText = '\n' + Object.entries(newItems).reduce((result, [name, {flags, value}]) =>
    result + renderItem(name, {flags, value})
  , '')

  return block
    ? body.replace(block.items, newItemsText)
    : body + `\n\n${blockName}:${newItemsText}`
}

export const setItem = (body, blockName, itemName, value, flags = []) => {
  const items = getItems(body, blockName) || {}

  return setItems(body, blockName, {
    ...items,
    [itemName]: {value, flags}
  })
}
