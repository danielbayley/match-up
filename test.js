import assert from "node:assert/strict"
import { describe, it, beforeEach, afterEach } from "node:test"
import fs from "node:fs/promises"
import { parse, sep, join, format } from "node:path"
import { createFixture } from "fs-fixture"
import { matchup } from "./index.js"

const { encoding } = new TextDecoder()

const file    = "file.ext"
const subpath = "sub/folder"
const target  = `..${file}`
const symlink = ({ symlink }) => symlink(target)
const folder  = { [Date.now()]: encoding }
const tree    = {
  [file]: encoding,
  sub: { folder, [file]: symlink }
}

describe("matchup", () => {
  let fixtures, cwd
  afterEach(() => fixtures.rm())
  beforeEach(mkdir)
  async function mkdir() {
    fixtures = await createFixture(tree)
    cwd = fixtures.getPath(subpath)
  }

  it("returns a path object for the match", async () => {
    const path = await matchup(file, { cwd })
    assert.doesNotThrow(() => format(path))
  })

  it("else an empty object if no match", async () => {
    const random = Math.max().toString(36).substring(7)
    const object = await matchup(`.${random}`, { cwd })
    assert.deepEqual(object, {})
  })

  it("finds nearest matching file", async () => {
    const {base} = await matchup(file, {cwd})
    assert.equal(base, file)
  })

  it("finds matching directory", async () => {
    const {name} = await matchup("sub", { cwd })
    assert.equal(name, "sub")
  })

  it("finds matching glob pattern", async () => {
    const {ext}   = parse(file)
    const pattern = file.replace(ext, ".*")
    const {base}  = await matchup(pattern, { cwd })
    assert.equal(base, file)
  })

  it("finds match up from dependency", async () => {
    const index      = "index.js"
    const dependency = "node_modules/@scope/package"
    const module     = join(dependency, index)
    const fixtures   = await createFixture({
      [file]: encoding,
      [module]: await fs.readFile(index, { encoding })
    })
    const {matchup} = await import(fixtures.getPath(module))
    const {base}    = await matchup(file)
    assert.equal(base, file)
    fixtures.rm()
  })

  it("ignores entries matching the given ignore patterns", async () => {
    const ignore = subpath.split(sep).slice(0, 1)
    const {dir}  = await matchup(file, { cwd, ignore })
    assert.equal(dir + sep, fixtures.path)
  })

  it("finds no match limited by depth", async () => {
    const match = await matchup(file, { cwd, max: 1 })
    assert.deepEqual(match, {})
  })

  it("matches symbolic links unless symlinks: false", async () => {
    const read = await fs.readlink(fixtures.getPath(`sub/${file}`))
    assert.equal(read, target)

    const cwd   = fixtures.getPath(subpath)
    const match = await matchup(file, { cwd })
    const root  = await matchup(file, { cwd, symlinks: false })
    assert.notDeepEqual(match, root)
  })
})
