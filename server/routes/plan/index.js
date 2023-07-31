const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')

const VERSION = require('../../config/version')
const router = koaRouter({prefix: `/api/${VERSION}/plan`})

/** 查询计划列表 */
router.get('/list', async (ctx, next) => {

})

/** 新增计划 */
router.post('/', async (ctx, next) => {})

/** 更新计划 */
router.put('/', async (ctx, next) => {})

/** 删除计划 */
router.delete('/', async (ctx, next) => {})