/** IndigoMx Native V2.1: inline wp.blockEditor.RichText + MediaUpload + block drag/reorder.
 * Original static HTML is the source of truth for each section; layout/class names
 * are kept untouched when the user changes words or images.
 * v2.1 image editing: sidebar image list, <picture>/background/poster support,
 * duplicate sync. Only image URLs change; markup structure and classes stay the same.
 */
(function (wp) {
  'use strict';
  const el = wp.element.createElement;
  const {useMemo, useState, useRef, useEffect} = wp.element;
  const {registerBlockType, registerBlockVariation} = wp.blocks;
  const {useBlockProps, RichText, MediaUpload, MediaUploadCheck, InspectorControls, BlockControls} = wp.blockEditor;
  const {PanelBody, TextControl, ToolbarGroup, ToolbarButton, Dropdown, Button} = wp.components;
  const {useSelect} = wp.data;
  const config = window.indigoV2Data || {};

  const DEFAULT_HTML = '<section class="section"><div class="container"><span class="eyebrow">New section</span><h2>Click here to edit this heading</h2><p>Click here to edit this paragraph. Move this section with the Gutenberg block toolbar.</p></div></section>';
  const svgNames = {
    'viewbox':'viewBox', 'stroke-linecap':'strokeLinecap', 'stroke-linejoin':'strokeLinejoin',
    'stroke-width':'strokeWidth', 'stroke-miterlimit':'strokeMiterlimit',
    'fill-rule':'fillRule', 'clip-rule':'clipRule', 'stop-color':'stopColor',
    'font-size':'fontSize', 'xlink:href':'xlinkHref'
  };
  const voidNames = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const textTags = new Set(['h1','h2','h3','h4','h5','h6','p','span','strong','em','b','i','small','a','li','label','div','figcaption','blockquote','time','button']);

  /* ---------- image helpers (new in v2.1) ---------- */
  const URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/i;
  function firstCssUrl(value) {
    const m = (value || '').match(URL_RE);
    return m ? m[2] : '';
  }
  function swapCssUrl(value, newUrl) {
    // Swaps only the first url(...) layer, so gradients/other layers are kept.
    return value.replace(URL_RE, 'url("' + newUrl.replace(/"/g, '%22') + '")');
  }
  function normUrl(u) {
    // Same file = same image, whether written as "assets/img/x.jpg" or a full theme URL.
    return (u || '').split(/[?#]/)[0].replace(/^.*?(assets\/)/i, '$1').replace(/^https?:\/\/[^/]+/i, '');
  }
  function collectFromTree(root) {
    const out = [];
    function walk(node, path) {
      if (node.nodeType !== 1) return;
      const tag = node.localName.toLowerCase();
      if (tag === 'svg') return;
      if (tag === 'img') {
        out.push({path, kind:'img', url:node.getAttribute('src') || '', mediaId:Number(node.getAttribute('data-media-id')) || undefined});
      } else if (tag === 'video' && node.getAttribute('poster')) {
        out.push({path, kind:'poster', url:node.getAttribute('poster')});
      }
      const inline = firstCssUrl(node.getAttribute('style'));
      if (inline) out.push({path, kind:'bg', url:inline});
      Array.from(node.childNodes).forEach((c, i) => walk(c, path + '.' + i));
    }
    Array.from(root.childNodes).forEach((n, i) => walk(n, String(i)));
    return out;
  }
  function groupImages(list) {
    const map = new Map();
    list.forEach(item => {
      const key = normUrl(item.url);
      if (!key) return;
      if (!map.has(key)) map.set(key, {key, url:item.url, mediaId:item.mediaId, items:[]});
      map.get(key).items.push(item);
    });
    return Array.from(map.values());
  }
  function groupLabel(g) {
    const kinds = new Set(g.items.map(i => i.kind));
    const name = kinds.has('img') ? 'Photo' : kinds.has('poster') ? 'Video cover' : 'Background image';
    return g.items.length > 1 ? name + ' · used ' + g.items.length + '×' : name;
  }

  /* ---------- original helpers ---------- */
  function asTree(html) {
    const doc = new DOMParser().parseFromString('<div id="indigov2-root">' + html + '</div>', 'text/html');
    return doc.getElementById('indigov2-root');
  }
  function byPath(root, path) {
    const steps = path.split('.').map(x=>Number(x));
    let node = root;
    for (const idx of steps) {
      if (!node || !node.childNodes[idx]) return null;
      node = node.childNodes[idx];
    }
    return node;
  }
  function textValue(value) {
    const d = new DOMParser().parseFromString('<div id="v">'+value+'</div>', 'text/html');
    return d.getElementById('v').textContent || '';
  }
  function rewriteUrl(value) {
    if (!value) return value;
    if (/^assets\//i.test(value)) return (config.themeUrl || '') + '/' + value;
    const hit = value.match(/^(index|about|services|work|contact)\.html([?#].*)?$/i);
    if (!hit) return value;
    const page = hit[1] === 'index' ? '' : hit[1] + '/';
    return (config.homeUrl || '/') + page + (hit[2] || '');
  }
  function previewMarkup(html) {
    return (html || '').replace(/(src|href|poster)=(['"])(assets\/[^'"]+)\2/gi, (_,k,q,path)=>k+'='+q+rewriteUrl(path)+q)
      .replace(/href=(['"])((?:index|about|services|work|contact)\.html(?:[?#][^'"]*)?)\1/gi,(_,q,url)=>'href='+q+rewriteUrl(url)+q);
  }
  function sectionKind(html, slug) {
    if (/\be2-hero\b/.test(html)) return 'home';
    const match = html.match(/\bpage-hero--(about|services|work|contact)\b/);
    return match ? match[1] : (['home','about','services','work','contact'].includes(slug) ? slug : 'inner');
  }
  function styleObject(node) {
    const obj = {};
    Array.from(node.style || []).forEach(name => {
      let k = name.replace(/-([a-z])/g, (_,x)=>x.toUpperCase());
      if (name.startsWith('--')) k = name;
      // Editor preview only: make relative assets/ URLs inside url(...) resolve.
      obj[k] = node.style.getPropertyValue(name).trim()
        .replace(/url\((['"]?)(assets\/[^'")]+)\1\)/gi, (_,q,path)=>'url('+q+rewriteUrl(path)+q+')');
    });
    return obj;
  }
  function propsFromNode(node) {
    const props = {};
    Array.from(node.attributes || []).forEach(a=>{
      const n = a.name.toLowerCase();
      const k = svgNames[n] || (n === 'class' ? 'className' : n === 'for' ? 'htmlFor' : n === 'tabindex' ? 'tabIndex' : n === 'readonly' ? 'readOnly' : n === 'maxlength' ? 'maxLength' : n === 'colspan' ? 'colSpan' : n === 'rowspan' ? 'rowSpan' : n === 'referrerpolicy' ? 'referrerPolicy' : n === 'fetchpriority' ? 'fetchPriority' : n);
      if (n === 'style') props.style = styleObject(node);
      else if (['hidden','disabled','required','multiple','checked','selected','readonly','autofocus','novalidate'].includes(n)) props[k === 'novalidate' ? 'noValidate' : k] = true;
      else if (n === 'src' || n === 'poster' || n === 'href') props[k] = rewriteUrl(a.value);
      else props[k] = a.value;
    });
    return props;
  }

  registerBlockType('indigomx/section', {
    apiVersion:3,
    title:'IndigoMx — Click-to-edit Section',
    icon:'edit-page',
    category:'design',
    description:'Click on headings and paragraphs to edit them directly. Click photos to replace, or use the image list in the sidebar. Move this whole section using Gutenberg drag-and-drop.',
    attributes:{html:{type:'string',default:''}},
    supports:{html:false, customClassName:false, anchor:false, reusable:true, multiple:true},
    edit:function (p) {
      const html = p.attributes.html || DEFAULT_HTML;
      const root = useMemo(()=>asTree(html),[html]);
      const [activeLink, setActiveLink] = useState(null);
      const [activeImage, setActiveImage] = useState(null);
      const [computedBgs, setComputedBgs] = useState([]);
      const mainRef = useRef(null);

      const blocksContext = useSelect(function(select) {
        const store = select('core/block-editor');
        const postStore = select('core/editor');
        const blocks = store ? store.getBlocks() : [];
        const sections = blocks.filter(b => b.name === 'indigomx/section');
        return {
          first: sections.length ? sections[0].clientId : null,
          last: sections.length ? sections[sections.length-1].clientId : null,
          firstHtml: sections.length ? (sections[0].attributes.html || '') : '',
          slug: postStore && postStore.getEditedPostAttribute ? (postStore.getEditedPostAttribute('slug') || '') : ''
        };
      }, []);
      const page = sectionKind(blocksContext.firstHtml, blocksContext.slug);
      const first = blocksContext.first === p.clientId;
      const last = blocksContext.last === p.clientId;
      const pageClass = page === 'home' ? 'v3-home' : 'v3-inner';
      const header = first && config.headers ? config.headers[page] || config.headers.inner || '' : '';
      const footer = last ? config.footer || '' : '';
      const blockProps = useBlockProps({className:'indigov2-section-block'});

      // Find background images that come from the theme CSS files (not visible in the HTML).
      useEffect(() => {
        const main = mainRef.current;
        if (!main) return;
        function scan() {
          const found = [];
          main.querySelectorAll('[data-ixp]').forEach(node => {
            if (node.localName === 'img') return;
            const view = node.ownerDocument.defaultView;
            if (!view) return;
            const bi = view.getComputedStyle(node).backgroundImage;
            const u = firstCssUrl(bi);
            if (u) found.push({path:node.getAttribute('data-ixp'), kind:'bg', url:u, computed:bi});
          });
          setComputedBgs(prev => JSON.stringify(prev) === JSON.stringify(found) ? prev : found);
        }
        scan();
        const t = setTimeout(scan, 700); // editor stylesheets can finish loading late
        return () => clearTimeout(t);
      }, [html, p.isSelected]);

      const treeImages = useMemo(()=>collectFromTree(root),[root]);
      const groups = useMemo(()=>{
        const seen = new Set(treeImages.filter(i=>i.kind==='bg').map(i=>i.path));
        return groupImages(treeImages.concat(computedBgs.filter(b=>!seen.has(b.path))));
      },[treeImages, computedBgs]);

      function mutate(path, operation) {
        const doc = asTree(p.attributes.html || DEFAULT_HTML);
        const target = byPath(doc,path);
        if (!target) return;
        operation(target);
        p.setAttributes({html:doc.innerHTML});
      }
      function changeText(path, value, wholeElement) {
        mutate(path, node => {
          if (wholeElement) node.textContent = textValue(value);
          else node.nodeValue = textValue(value);
        });
      }
      function changeAttribute(path, name, value) {
        mutate(path,node=>{
          if (node.nodeType !== 1) return;
          node.setAttribute(name,value);
          if (name === 'src') {node.removeAttribute('srcset');node.removeAttribute('sizes');}
        });
      }

      // Replace one image everywhere it appears in this section. Only URLs change.
      function replaceImages(items, media) {
        if (!media || !media.url) return;
        const url = media.url;
        const doc = asTree(p.attributes.html || DEFAULT_HTML);
        const targets = items.map(it => ({it, node:byPath(doc, it.path)})).filter(t => t.node && t.node.nodeType === 1);
        const dropSources = [];
        targets.forEach(({it, node}) => {
          if (it.kind === 'img') {
            node.setAttribute('src', url);
            ['srcset','sizes','data-srcset','data-sizes'].forEach(a=>node.removeAttribute(a));
            if (node.hasAttribute('data-src')) node.setAttribute('data-src', url);
            if (media.id) node.setAttribute('data-media-id', String(media.id));
            if (media.alt) node.setAttribute('alt', media.alt);
            const pic = node.parentNode;
            if (pic && pic.localName === 'picture') {
              Array.from(pic.children).forEach(c => { if (c.localName === 'source') dropSources.push(c); });
            }
          } else if (it.kind === 'poster') {
            node.setAttribute('poster', url);
          } else if (it.kind === 'bg') {
            const inline = node.getAttribute('style') || '';
            if (firstCssUrl(inline)) {
              node.setAttribute('style', swapCssUrl(inline, url));
            } else {
              const layer = swapCssUrl(it.computed || 'url("")', url);
              node.setAttribute('style', (inline.trim() ? inline.trim().replace(/;?$/, '; ') : '') + 'background-image: ' + layer + ';');
            }
          }
        });
        dropSources.forEach(s => s.parentNode && s.parentNode.removeChild(s));
        setActiveImage(null);
        p.setAttributes({html:doc.innerHTML});
      }
      function groupForPath(path) {
        return groups.find(g => g.items.some(i => i.path === path)) || {items:[{path, kind:'img'}]};
      }

      function renderNode(node, path, allowEdit, inSvg) {
        if (node.nodeType === 8) return null;
        if (node.nodeType === 3) {
          const value = node.nodeValue;
          if (!allowEdit || !value.trim()) return value;
          return el(RichText, {
            key:'text-'+path, tagName:'span', value:value, allowedFormats:[],
            className:'indigov2-inline-text',
            'aria-label':'Click to edit text',
            onChange: v=>changeText(path,v,false),
            placeholder:'Type here…',
            withoutInteractiveFormatting:true
          });
        }
        if (node.nodeType !== 1) return null;
        const tag = node.localName.toLowerCase();
        const props = propsFromNode(node);
        props.key = path;
        const svg = inSvg || tag === 'svg';
        const editable = allowEdit && !svg && !node.closest('[aria-hidden="true"]') && !['script','style','noscript','option','select','textarea','iframe'].includes(tag);

        if (tag === 'a') {
          props.onClick = evt=>{evt.preventDefault();setActiveLink(path);};
          props.onKeyDown = evt=>{if(evt.key==='Enter' && !evt.shiftKey)evt.preventDefault();};
        }
        if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') {
          if (tag !== 'button') props.disabled = true;
          else props.onClick = ev=>ev.preventDefault();
        }
        if (tag === 'img' && !svg) {
          const openImage = open=>el('img', Object.assign({}, props, {
            key:path,
            'data-ixp':path,
            className:((props.className || '')+' indigov2-media-click').trim(),
            title:'Click to replace image in WordPress Media Library',
            role:'button', tabIndex:0,
            onClick:ev=>{ev.preventDefault();setActiveImage(path);open();},
            onKeyDown:ev=>{if(ev.key==='Enter' || ev.key===' '){ev.preventDefault();setActiveImage(path);open();}}
          }));
          return el(MediaUploadCheck,{key:'check-'+path},el(MediaUpload,{
            allowedTypes:['image'],
            value:Number(node.getAttribute('data-media-id')) || undefined,
            onSelect: media=>replaceImages(groupForPath(path).items, media),
            render:({open})=>openImage(open)
          }));
        }

        const kids = Array.from(node.childNodes);
        if (editable && textTags.has(tag) && kids.length === 1 && kids[0].nodeType === 3 && kids[0].nodeValue.trim()) {
          return el(RichText, Object.assign({},props,{
            tagName:tag, value:kids[0].nodeValue, allowedFormats:[],
            onChange:v=>changeText(path,v,true),
            withoutInteractiveFormatting:true,
            placeholder:'Type here…'
          }));
        }
        if (!svg) props['data-ixp'] = path; // editor-only marker, never saved
        if (voidNames.has(tag)) return el(tag,props);
        if (tag === 'iframe') return el('div',{key:path,className:'indigov2-map-placeholder','aria-label':'Map preview'},'Map displayed on published page');
        const children = kids.map((child,i)=>renderNode(child,path+'.'+i,editable,svg));
        return el(tag,props,...children);
      }

      const topNodes = Array.from(root.childNodes).map((n,i)=>renderNode(n,String(i),true,false));
      const linkNode = activeLink ? byPath(root,activeLink) : null;
      const imageNode = activeImage ? byPath(root,activeImage) : null;

      const thumbStyle = {width:'56px',height:'56px',objectFit:'cover',borderRadius:'4px',background:'#eee',flex:'0 0 56px'};
      const rowStyle = {display:'flex',gap:'10px',alignItems:'center',marginBottom:'12px'};

      return el('div',blockProps,
        el(BlockControls,{},
          imageNode && imageNode.nodeType === 1 ? el(ToolbarGroup,{},
            el(MediaUploadCheck,{},el(MediaUpload,{
              allowedTypes:['image'],
              value:Number(imageNode.getAttribute('data-media-id')) || undefined,
              onSelect:media=>replaceImages(groupForPath(activeImage).items, media),
              render:({open})=>el(ToolbarButton,{icon:'format-image',label:'Replace image',onClick:open},'Replace image')
            }))
          ) : null,
          linkNode && linkNode.nodeType === 1 ? el(ToolbarGroup,{},
            el(Dropdown,{
              renderToggle:({isOpen,onToggle})=>el(ToolbarButton,{
                icon:'admin-links',label:'Edit selected link URL',
                isPressed:isOpen,onClick:onToggle
              }),
              renderContent:()=>el('div',{style:{padding:'14px',minWidth:'300px'}},
                el(TextControl,{
                  label:'Destination URL',value:linkNode.getAttribute('href')||'',
                  onChange:v=>changeAttribute(activeLink,'href',v)
                })
              )
            })
          ) : null
        ),
        el(InspectorControls,{},
          el(PanelBody,{title:'Images in this section ('+groups.length+')',initialOpen:true},
            groups.length ? groups.map(g=>el('div',{key:g.key,style:rowStyle},
              el('img',{src:rewriteUrl(g.url),alt:'',style:thumbStyle}),
              el('div',{style:{flex:'1',minWidth:0}},
                el('div',{style:{fontSize:'12px',marginBottom:'6px'}},groupLabel(g)),
                el(MediaUploadCheck,{},el(MediaUpload,{
                  allowedTypes:['image'],
                  value:g.mediaId,
                  onSelect:media=>replaceImages(g.items, media),
                  render:({open})=>el(Button,{variant:'secondary',onClick:open},'Replace')
                }))
              )
            )) : el('p',{},'No images found in this section.')
          ),
          el(PanelBody,{title:'How to edit this page',initialOpen:false},
            el('p',{},'Click any heading, paragraph, button label, or other text in the page to type directly. Click a photo to replace it, or use “Images in this section” above (this also covers background images). Use Gutenberg’s block toolbar to drag, duplicate, or move this section.'),
            el('p',{},'The original section layout is preserved. To add a completely new area, use the + inserter; regular WordPress blocks are available too.')
          ),
          linkNode && linkNode.nodeType === 1 ? el(PanelBody,{title:'Selected link',initialOpen:true},
            el(TextControl,{
              label:'Destination URL',value:linkNode.getAttribute('href')||'',
              onChange:v=>changeAttribute(activeLink,'href',v),
              help:'Links are disabled while editing. Click the link in the page, then update its URL here.'
            })
          ) : null,
          imageNode && imageNode.nodeType === 1 ? el(PanelBody,{title:'Selected image',initialOpen:true},
            el(TextControl,{
              label:'Alternative text', value:imageNode.getAttribute('alt')||'',
              onChange:v=>changeAttribute(activeImage,'alt',v)
            })
          ) : null
        ),
        el('div',{className:'indigov2-live-canvas '+pageClass},
          header ? el('div',{className:'indigov2-fixed-header',dangerouslySetInnerHTML:{__html:previewMarkup(header)}}) : null,
          el('main',first?{id:'main',className:'indigov2-preview-main',ref:mainRef}:{className:'indigov2-preview-main',ref:mainRef},...topNodes),
          footer ? el('div',{className:'indigov2-fixed-footer',dangerouslySetInnerHTML:{__html:previewMarkup(footer)}}) : null
        )
      );
    },
    save:function(){return null;}
  });

  const names = {
    home:['Hero','Our approach','Client marquee','Services cards','Founder','Company statistics','Publications','How we work','Consultation banner'],
    about:['About hero','About the studio','Mission','Founder biography','Our team','Client list','Consultation banner'],
    services:['Services hero','Three service offerings','Consultation banner'],
    work:['Our work hero','Project gallery','Publications','Consultation banner'],
    contact:['Contact hero','Contact details and form']
  };
  Object.keys(config.presets || {}).forEach(page=>{
    const sections = config.presets[page];
    if (!Array.isArray(sections)) return;
    sections.forEach((html,i)=>{
      if(typeof html !== 'string') return;
      registerBlockVariation('indigomx/section',{
        name:'indigov2-'+page+'-'+i,
        title:'IndigoMx: '+(names[page]||[])[i],
        description:'Ready-made '+page+' section with inline click-to-edit fields.',
        attributes:{html},
        scope:['inserter']
      });
    });
  });
})(window.wp);