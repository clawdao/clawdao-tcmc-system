const Router = require('@koa/router');
const { ok } = require('../middlewares/error');
const stats = require('../services/statsService');

const router = new Router({ prefix: '/api/stats' });

router.get('/overview', (ctx) => ok(ctx, stats.overview(ctx.query)));
router.get('/diseases', (ctx) => ok(ctx, stats.diseases(ctx.query)));
router.get('/herbs', (ctx) => ok(ctx, stats.herbs(ctx.query)));
router.get('/syndromes', (ctx) => ok(ctx, stats.syndromes(ctx.query)));
router.get('/outcomes', (ctx) => ok(ctx, stats.outcomes(ctx.query)));
router.get('/trend', (ctx) => ok(ctx, stats.trend(ctx.query)));
router.get('/doctors', (ctx) => ok(ctx, stats.doctors(ctx.query)));

module.exports = router;
