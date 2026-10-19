"""Custom CSS for the botanical theme."""

CSS = """
<style>
:root {
  --leaf-900: #1d4a30; --leaf-700: #2f7d4f; --leaf-100: #e6efe0;
  --amber-700: #8a5a00; --amber-100: #fdf3dc;
  --red-700: #9b2c2c; --red-100: #fde8e8;
  --slate-700: #3c4a55; --slate-100: #eaf0f4;
}
.block-container { max-width: 1150px; padding-top: 2rem; }
.hero {
  background: linear-gradient(135deg, #1d4a30 0%, #2f7d4f 60%, #5f9e6e 100%);
  color: #fff; border-radius: 18px; padding: 1.6rem 1.8rem; margin-bottom: 1.2rem;
}
.hero h1 { color: #fff; font-size: 2rem; margin: 0 0 .35rem 0; padding: 0; }
.hero p { color: #e9f3ea; margin: 0; font-size: 1.02rem; line-height: 1.5; }
.chips { margin-top: .8rem; display: flex; flex-wrap: wrap; gap: .4rem; }
.chip { background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.3);
        border-radius: 999px; padding: .15rem .7rem; font-size: .82rem; color: #fff; }
.status { border-radius: 14px; padding: 1rem 1.2rem; margin: .4rem 0 1rem 0; border-left: 6px solid; }
.status h3 { margin: 0 0 .25rem 0; font-size: 1.15rem; padding: 0; }
.status p { margin: 0; line-height: 1.5; }
.status.good { background: var(--leaf-100); border-color: var(--leaf-700); color: var(--leaf-900); }
.status.warn { background: var(--amber-100); border-color: #d99a1e; color: #5b3d00; }
.status.info { background: var(--slate-100); border-color: #6b8796; color: var(--slate-700); }
.status.bad  { background: var(--red-100); border-color: #c24141; color: var(--red-700); }
.card { background: #fff; border: 1px solid #dfe8da; border-radius: 14px; padding: 1rem 1.1rem; height: 100%; }
.card .k { font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; color: #5d6f62; }
.card .v { font-size: 1.15rem; font-weight: 600; color: #1f2d24; margin-top: .15rem; word-wrap: break-word; }
.card .s { font-size: .82rem; color: #5d6f62; margin-top: .2rem; }
.disclaimer { font-size: .85rem; color: #4d5c52; background: #fff; border: 1px dashed #b9cbb4;
              border-radius: 12px; padding: .8rem 1rem; margin-top: 1rem; }
@media (max-width: 640px) {
  .hero { padding: 1.1rem 1.1rem; }
  .hero h1 { font-size: 1.5rem; }
  .block-container { padding-left: 1rem; padding-right: 1rem; }
}
</style>
"""
