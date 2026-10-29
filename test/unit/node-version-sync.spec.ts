// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Node 版本手動同步在三處：.nvmrc（CI 讀它）、Dockerfile ARG 預設值（正式機映像檔用它）、package.json engines。
// 只改 .nvmrc 會讓 CI 測新版、映像檔仍是舊版，這支測試讓三處不一致時 CI 變紅（#196，同模板 #184）。
function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8')
}

const nvmrc = read('.nvmrc').trim()

describe('三處 Node 版本同步', () => {
  it('.nvmrc 是確切版本號', () => {
    expect(nvmrc, '.nvmrc 要寫 x.y.z，不寫浮動版（26、lts/*）').toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('映像檔：Dockerfile 的 ARG NODE_VERSION 預設值等於 .nvmrc', () => {
    const arg = read('Dockerfile').match(/^ARG NODE_VERSION=(\S+)$/m)?.[1]
    expect(arg, `Dockerfile 的 ARG NODE_VERSION 與 .nvmrc（${nvmrc}）不一致`).toBe(nvmrc)
  })

  it('package.json 的 engines.node 等於 >=<.nvmrc>', () => {
    const engines = (JSON.parse(read('package.json')) as { engines?: { node?: string } }).engines?.node
    expect(engines, `package.json 的 engines.node 與 .nvmrc（${nvmrc}）不一致`).toBe(`>=${nvmrc}`)
  })
})
