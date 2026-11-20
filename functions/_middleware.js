/**
 * Cloudflare Pages Functions Host-based Router
 * 一个 GitHub 仓库 + 一个 Cloudflare Pages 项目托管全部 12 个子域名！
 *
 * 映射规则：
 *   mjmy.ofjing.com            -> /hub/*
 *   mjmy-linli.ofjing.com      -> /linli/*
 *   mjmy-cinema.ofjing.com     -> /cinema/*
 *   mjmy-letter.ofjing.com     -> /letter/*
 *   mjmy-101.ofjing.com        -> /101/*
 *   mjmy-vibecoding.ofjing.com -> /vibecoding/*
 *   mjmy-collection.ofjing.com -> /collection/*
 *   mjmy-next.ofjing.com       -> /next/*
 *   mjmy-same.ofjing.com       -> /same/*
 *   mjmy-note.ofjing.com       -> /note/*
 *   mjmy-info.ofjing.com       -> /info/*
 *   mjmy-thanks.ofjing.com     -> /thanks/*
 */

const HOST_MAP = {
  'mjmy.ofjing.com': '/hub',
  'ofjing.com': '/hub',
  'www.ofjing.com': '/hub',
  'mjmy-linli.ofjing.com': '/linli',
  'mjmy-cinema.ofjing.com': '/cinema',
  'mjmy-letter.ofjing.com': '/letter',
  'mjmy-101.ofjing.com': '/101',
  'mjmy-vibecoding.ofjing.com': '/vibecoding',
  'mjmy-collection.ofjing.com': '/collection',
  'mjmy-next.ofjing.com': '/next',
  'mjmy-same.ofjing.com': '/same',
  'mjmy-note.ofjing.com': '/note',
  'mjmy-info.ofjing.com': '/info',
  'mjmy-thanks.ofjing.com': '/thanks',
};

const PASSTHROUGH_PREFIXES = ['/api/', '/shared/'];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  // API 与公共脚本直接放行
  if (PASSTHROUGH_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    return context.next();
  }

  const targetBase = HOST_MAP[host];
  if (!targetBase) {
    // localhost / pages.dev 预览：根路径跳到 /hub/，其余路径原样访问
    if (url.pathname === '/' || url.pathname === '') {
      return Response.redirect(new URL('/hub/', url), 302);
    }
    return context.next();
  }

  // 如果路径本身已经带了目标前缀，直接放行避免循环
  if (url.pathname === targetBase || url.pathname.startsWith(targetBase + '/')) {
    return context.next();
  }

  const rewritten = new URL(context.request.url);
  rewritten.pathname = targetBase + (url.pathname.startsWith('/') ? url.pathname : '/' + url.pathname);
  return context.env.ASSETS.fetch(new Request(rewritten.toString(), context.request));
}
