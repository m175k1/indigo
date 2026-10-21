<?php get_header(); ?>
<main id="main"><?php while(have_posts()){the_post();the_content();} ?></main>
<?php get_footer(); ?>