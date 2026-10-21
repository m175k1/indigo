<!doctype html>
<html <?php language_attributes(); ?>><head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/png" href="<?php echo esc_url(get_template_directory_uri().'/assets/img/favicon.png'); ?>">
<?php wp_head(); ?></head><body <?php body_class(); ?>><?php wp_body_open(); ?>
<?php
$header_name = 'inner';
if (is_front_page()) $header_name = 'home';
elseif (is_page('about')) $header_name = 'about';
elseif (is_page('services')) $header_name = 'services';
elseif (is_page('work')) $header_name = 'work';
elseif (is_page('contact')) $header_name = 'contact';
$header_file = get_template_directory() . '/partials/header-' . $header_name . '.html';
if (is_readable($header_file)) {
    echo indigov2_urls(file_get_contents($header_file));
}
?>
