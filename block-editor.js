/** IndigoMx Native V2: inline wp.blockEditor.RichText + MediaUpload + block drag/reorder.
 * Original static HTML is the source of truth for each section; layout/class names
 * are kept untouched when the user changes words or images.
 */
(function (wp) {
  'use strict';
  const el = wp.element.createElement;
  const {useMemo, useState} = wp.element;
  const {registerBlockType, registerBlockVariation} = wp.blocks;
  const {useBlockProps, RichText, MediaUpload, MediaUploadCheck, InspectorControls, BlockControls} = wp.blockEditor;
  const {PanelBody, TextControl, ToolbarGroup, ToolbarButton, Dropdown} = wp.components;
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
    // RichText returns HTML entities as markup. Here the source has dedicated
    // text nodes, so store only the literal text the visitor should see.
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
      obj[k] = node.style.getPropertyValue(name).trim();
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
  function htmlToPlain(node) {
    return node ? node.textContent || '' : '';
  }

  registerBlockType('indigomx/section', {
    apiVersion:3,
    title:'IndigoMx — Click-to-edit Section',
    icon:'edit-page',
    category:'design',
    description:'Click on headings and paragraphs to edit them directly. Click photos to replace. Move this whole section using Gutenberg drag-and-drop.',
    attributes:{html:{type:'string',default:''}},
    supports:{html:false, customClassName:false, anchor:false, reusable:true, multiple:true},
    edit:function (p) {
      const html = p.attributes.html || DEFAULT_HTML;
      const root = useMemo(()=>asTree(html),[html]);
      const [activeLink, setActiveLink] = useState(null);
      const [activeImage, setActiveImage] = useState(null);
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
      function renderNode(node, path, allowEdit, inSvg) {
        if (node.nodeType === 8) return null; // HTML comment, not visible
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
        // Links must be inert while editing, so clicks do not navigate away.
        if (tag === 'a') {
          props.onClick = evt=>{evt.preventDefault();setActiveLink(path);};
          props.onKeyDown = evt=>{if(evt.key==='Enter' && !evt.shiftKey)evt.preventDefault();};
        }
        if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') {
          // Editable captions remain editable, but form controls do not submit
          // or interfere with the editor's focus/selection.
          if (tag !== 'button') props.disabled = true;
          else props.onClick = ev=>ev.preventDefault();
        }
        if (tag === 'img') {
          const openImage = open=>el('img', Object.assign({}, props, {
            key:path,
            className:((props.className || '')+' indigov2-media-click').trim(),
            title:'Click to replace image in WordPress Media Library',
            role:'button', tabIndex:0,
            onClick:ev=>{ev.preventDefault();setActiveImage(path);open();},
            onKeyDown:ev=>{if(ev.key==='Enter' || ev.key===' '){ev.preventDefault();setActiveImage(path);open();}}
          }));
          return el(MediaUploadCheck,{key:'check-'+path},el(MediaUpload,{
            allowedTypes:['image'],
            value:undefined,
            onSelect: media=>{
              if (media && media.url) mutate(path,node=>{
                node.setAttribute('src', media.url);
                node.removeAttribute('srcset');
                node.removeAttribute('sizes');
                if (media.alt) node.setAttribute('alt', media.alt);
              });
            },
            render:({open})=>openImage(open)
          }));
        }
        // Direct WP RichText on the ORIGINAL element, not a sidebar input.
        // This retains the element's original tag and CSS class, improving fidelity.
        const kids = Array.from(node.childNodes);
        if (editable && textTags.has(tag) && kids.length === 1 && kids[0].nodeType === 3 && kids[0].nodeValue.trim()) {
          return el(RichText, Object.assign({},props,{
            tagName:tag, value:kids[0].nodeValue, allowedFormats:[],
            onChange:v=>changeText(path,v,true),
            withoutInteractiveFormatting:true,
            placeholder:'Type here…'
          }));
        }
        if (voidNames.has(tag)) return el(tag,props);
        if (tag === 'iframe') return el('div',{key:path,className:'indigov2-map-placeholder','aria-label':'Map preview'},'Map displayed on published page');
        const children = kids.map((child,i)=>renderNode(child,path+'.'+i,editable,svg));
        return el(tag,props,...children);
      }
      const topNodes = Array.from(root.childNodes).map((n,i)=>renderNode(n,String(i),true,false));
      const linkNode = activeLink ? byPath(root,activeLink) : null;
      const imageNode = activeImage ? byPath(root,activeImage) : null;

      return el('div',blockProps,
        el(BlockControls,{},
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
          el(PanelBody,{title:'How to edit this page',initialOpen:false},
            el('p',{},'Click any heading, paragraph, button label, or other text in the page to type directly. Click an image to replace it. Use Gutenberg’s block toolbar to drag, duplicate, or move this section.'),
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
          el('main',first?{id:'main',className:'indigov2-preview-main'}:{className:'indigov2-preview-main'},...topNodes),
          footer ? el('div',{className:'indigov2-fixed-footer',dangerouslySetInnerHTML:{__html:previewMarkup(footer)}}) : null
        )
      );
    },
    save:function(){return null;}
  });

  // Client can add one of the original section layouts with the native + inserter,
  // or use ordinary Gutenberg Heading, Paragraph, Image, Columns and Group blocks.
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
