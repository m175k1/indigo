<?php
/** IndigoMx Native Gutenberg v2. Does NOT depend on a third-party page builder. */
if (!defined('ABSPATH')) { exit; }

function indigov2_version($path) {
    $file = get_template_directory() . '/' . $path;
    return file_exists($file) ? (string) filemtime($file) : '2.0.0';
}
function indigov2_assets() {
    $uri = get_template_directory_uri();
    wp_enqueue_style('indigov2-fonts', 'https://fonts.googleapis.com/css2?family=Carlito:ital,wght@0,400;0,700;1,400&family=Fira+Sans:wght@600;700&display=swap', array(), null);
    foreach (array('style', 'index2', 'v3', 'effects') as $style) {
        $file = 'css/' . $style . '.css';
        wp_enqueue_style('indigov2-' . $style, $uri . '/' . $file, array(), indigov2_version($file));
    }
    wp_enqueue_script('indigov2-interactions', $uri . '/js/main.js', array(), indigov2_version('js/main.js'), true);
}
add_action('wp_enqueue_scripts', 'indigov2_assets');

function indigov2_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('editor-styles');
    add_theme_support('align-wide');
    add_theme_support('responsive-embeds');
    add_editor_style(array('css/style.css', 'css/index2.css', 'css/v3.css', 'css/effects.css', 'editor.css'));
}
add_action('after_setup_theme', 'indigov2_setup');

function indigov2_editor_font() {
    if (is_admin()) {
        wp_enqueue_style('indigov2-editor-fonts', 'https://fonts.googleapis.com/css2?family=Carlito:ital,wght@0,400;0,700;1,400&family=Fira+Sans:wght@600;700&display=swap', array(), null);
    }
}
add_action('enqueue_block_assets', 'indigov2_editor_font');

// Static source references are intentionally preserved in database so front-end
// asset/site URLs continue to work when WordPress is installed in a subfolder.
function indigov2_urls($html) {
    if (!is_string($html)) return '';
    $base = esc_url(get_template_directory_uri());
    $html = preg_replace_callback('~(src|href|poster)=("|\')(assets/[^"\']+)\2~i', function($m) use ($base) {
        return $m[1] . '=' . $m[2] . $base . '/' . $m[3] . $m[2];
    }, $html);
    $html = preg_replace_callback('~href=("|\')((?:index|about|services|work|contact)\.html)((?:[?#][^"\']*)?)\1~i', function($m) {
        $slug = strtolower(substr($m[2], 0, -5));
        $url = $slug === 'index' ? home_url('/') : home_url('/' . $slug . '/');
        return 'href=' . $m[1] . esc_url($url . $m[3]) . $m[1];
    }, $html);
    return $html;
}
function indigov2_render_section($attributes) {
    // HTML comes from users allowed to edit site content. wp_kses_post() would
    // remove original SVG, form, iframe, and other design markup, breaking fidelity.
    // WordPress' unfiltered_html permission must be restricted to trusted admins.
    return isset($attributes['html']) && is_string($attributes['html']) ? indigov2_urls($attributes['html']) : '';
}

function indigov2_blocks() {
    $uri = get_template_directory_uri();
    wp_register_script('indigov2-block-editor', $uri . '/block-editor.js', array('wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-data', 'wp-i18n'), indigov2_version('block-editor.js'), true);
    $headers = array();
    foreach (array('home', 'about', 'services', 'work', 'contact', 'inner') as $slug) {
        $path = get_template_directory() . '/partials/header-' . $slug . '.html';
        $headers[$slug] = indigov2_header_html($slug);
    }
    $footer_file = get_template_directory() . '/partials/footer.html';
    $presets = array();
    foreach (array('home','about','services','work','contact') as $slug) {
        $path = get_template_directory() . '/starter-pages/' . $slug . '.json';
        $presets[$slug] = is_readable($path) ? json_decode(file_get_contents($path), true) : array();
    }
    wp_localize_script('indigov2-block-editor', 'indigoV2Data', array(
        'themeUrl' => $uri,
        'homeUrl' => home_url('/'),
        'headers' => $headers,
        'footer' => is_readable($footer_file) ? indigov2_urls(file_get_contents($footer_file)) : '',
        'presets' => $presets,
    ));
    register_block_type('indigomx/section', array(
        'api_version' => 3,
        'editor_script' => 'indigov2-block-editor',
        'render_callback' => 'indigov2_render_section',
        'attributes' => array('html' => array('type' => 'string', 'default' => '')),
        'supports' => array('html' => false, 'anchor' => false, 'customClassName' => false),
    ));

}
add_action('init', 'indigov2_blocks');

function indigov2_starter_content($slug) {
    $path = get_template_directory() . '/starter-pages/' . $slug . '.json';
    if (!is_readable($path)) return '';
    $sections = json_decode(file_get_contents($path), true);
    if (!is_array($sections)) return '';
    $blocks = '';
    foreach ($sections as $html) {
        if (!is_string($html)) continue;
        // Escapes are ESSENTIAL. wp_insert_post() unslashes its input!
        $json = wp_json_encode(array('html' => $html), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        if (!$json) continue;
        $blocks .= '<!-- wp:indigomx/section ' . $json . ' /-->' . "\n\n";
    }
    return $blocks;
}
function indigov2_initial_pages() {
    if (get_option('indigov2_pages_initialized')) return;
    $home_id = 0;
    foreach (array('home'=>'Home', 'about'=>'About', 'services'=>'Services', 'work'=>'Our Work', 'contact'=>'Contact') as $slug=>$title) {
        $existing = get_page_by_path($slug);
        if ($existing) {
            // Existing v1 data already uses the SAME block identifier and HTML
            // attributes. There is intentionally NO database conversion.
            if ($slug === 'home') $home_id = (int) $existing->ID;
            continue;
        }
        $content = indigov2_starter_content($slug);
        if (!$content) continue;
        $id = wp_insert_post(wp_slash(array('post_type'=>'page', 'post_title'=>$title, 'post_name'=>$slug, 'post_status'=>'publish', 'post_content'=>$content)), true);
        if ($slug === 'home' && !is_wp_error($id)) $home_id = (int) $id;
    }
    if ($home_id && get_option('show_on_front') !== 'page') {
        update_option('show_on_front', 'page');
        update_option('page_on_front', $home_id);
    }
    update_option('indigov2_pages_initialized', 1);
}
add_action('after_switch_theme', 'indigov2_initial_pages');
add_filter('body_class', function($classes) {
    $classes[] = is_front_page() ? 'v3-home' : 'v3-inner';
    return array_unique($classes);
});
/* ---------- Extra header links via Appearance → Menus (v2.2) ----------
 * The default links in partials/header-*.html stay as they are.
 * Items in the "indigo-extra" menu are added after them.
 * If that menu is empty, the header HTML is unchanged. */

add_action('after_setup_theme', function () {
	register_nav_menus(array(
		'indigo-extra' => __('Header – extra links (after default)', 'indigo'),
	));
});

function indigov2_extra_menu_items() {
	$locations = get_nav_menu_locations();
	if (empty($locations['indigo-extra'])) return array();
	$items = wp_get_nav_menu_items($locations['indigo-extra']);
	if (!$items) return array();
	// Top-level items only (the static header has no dropdown styling).
	return array_values(array_filter($items, function ($i) { return (int) $i->menu_item_parent === 0; }));
}

// Reads the classes of the first link in a list, minus any "active/current" class.
function indigov2_link_classes($fragment) {
	$clean = function ($c) { return trim(preg_replace('~\S*(?:active|current|selected)\S*~i', '', $c)); };
	$li = $a = '';
	if (preg_match('~<li\b([^>]*)>~i', $fragment, $m) && preg_match('~\bclass=(["\'])(.*?)\1~i', $m[1], $c)) $li = $clean($c[2]);
	if (preg_match('~<a\b([^>]*)>~i', $fragment, $m) && preg_match('~\bclass=(["\'])(.*?)\1~i', $m[1], $c)) $a = $clean($c[2]);
	return array($li, $a);
}

function indigov2_extra_menu_html($li_class = '', $a_class = '') {
	$items = indigov2_extra_menu_items();
	if (!$items) return '';
	$current = (!is_admin() && is_singular()) ? (int) get_queried_object_id() : 0;
	$out = '';
	foreach ($items as $item) {
		$is_current = $current && $item->type === 'post_type' && (int) $item->object_id === $current;
		$target = $item->target ? ' target="' . esc_attr($item->target) . '" rel="noopener"' : '';
		$out .= '<li class="' . esc_attr(trim($li_class . ' indigo-extra-item')) . '">'
			. '<a' . ($a_class ? ' class="' . esc_attr($a_class) . '"' : '')
			. ' href="' . esc_url($item->url) . '"' . $target . ($is_current ? ' aria-current="page"' : '') . '>'
			. esc_html($item->title) . '</a></li>';
	}
	return $out;
}

function indigov2_inject_extra_menu($html) {
	if (!indigov2_extra_menu_items()) return $html; // nothing to add: output unchanged

	// Option 1: exact placement with a marker in the partial file.
	$marker = '<!-- indigo:menu-extra -->';
	if (strpos($html, $marker) !== false) {
		$parts = explode($marker, $html);
		$out = array_shift($parts);
		foreach ($parts as $part) {
			$ul = strripos($out, '<ul');
			list($li, $a) = indigov2_link_classes($ul === false ? '' : substr($out, $ul));
			$out .= indigov2_extra_menu_html($li, $a) . $part;
		}
		return $out;
	}

	// Option 2 (automatic): append to the end of the link list in every <nav>.
	return preg_replace_callback('~<nav\b.*?</nav>~is', function ($m) {
		$nav = $m[0];
		$end = strripos($nav, '</ul>');
		if ($end === false) return $nav;
		$start = strripos(substr($nav, 0, $end), '<ul');
		list($li, $a) = indigov2_link_classes($start === false ? '' : substr($nav, $start, $end - $start));
		return substr($nav, 0, $end) . indigov2_extra_menu_html($li, $a) . substr($nav, $end);
	}, $html);
}

function indigov2_header_html($slug) {
	$path = get_template_directory() . '/partials/header-' . $slug . '.html';
	if (!is_readable($path)) return '';
	return indigov2_inject_extra_menu(indigov2_urls(file_get_contents($path)));
}