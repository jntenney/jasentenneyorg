<script setup>
import HeaderSection from './components/HeaderSection.vue';
import HeroSection from './components/HeroSection.vue';
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { gsap } from 'gsap';
import { Observer } from 'gsap/dist/Observer';
import SplitText from 'gsap/SplitText';

gsap.registerPlugin(Observer, SplitText);

const sections = ref([]);
const images = ref([]);
const headings = ref([]);
const continueScrollings = ref([]);
const outerWrappers = ref([]);
const innerWrappers = ref([]);
const splitHeadings = ref([]);
const splitContinueScrollings = ref([]);

let currentIndex = ref(-1);
const animating = ref(false);
// Direction (+1 / -1) of a key press that arrived mid-transition; replayed once the slide settles.
let pendingDirection = 0;
// The transition currently playing and the slide it is moving away from, so a new transition can
// finish its cleanup if it starts before the previous one has fully ended.
let activeTimeline = null;
let outgoingIndex = -1;

let observerInstance = null;

// Unsplash resizes on request, so ask for a rendition sized to the viewport instead of always 1920px.
// The tiers match the media queries on the preload links in index.html so the preloaded files are the
// ones actually used.
const imageWidth = window.innerWidth <= 540 ? 1080 : window.innerWidth <= 960 ? 1440 : 1920;
const sizedForViewport = (url) => url.replace('w=1920', `w=${imageWidth}`);

const bgImages = ref([
  'https://images.unsplash.com/photo-1617478755490-e21232a5eeaf?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1617128734662-66da6c1d3505?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1617438817509-70e91ad264a5?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1617412327653-c29093585207?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1617141636403-f511e2d5dc17?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1728618562042-f829dbc0ef97?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1728593447201-d3a4506b15a4?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1728794371271-501a846645be?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1704115859446-601dfae181c2?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1728237646970-e73938b2c1d1?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
  'https://images.unsplash.com/photo-1728155253434-262ab74ef031?crop=entropy&cs=srgb&fm=jpg&ixid=MnwxNDU4OXwwfDF8cmFuZG9tfHx8fHx8fHx8MTYxNzU1NjM5NA&ixlib=rb-1.2.1&q=75&w=1920',
].map(sizedForViewport));

const scrollCount = ref(0);

// Respect the OS "reduce motion" setting: slides still change, but without the parallax and
// per-character entrance animations.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = reduceMotion
  ? { duration: 0, charDuration: 0, staggerAmount: 0, charDelay: 0 }
  : { duration: 1.25, charDuration: 1, staggerAmount: 0.6, charDelay: 0.2 };

onMounted(async () => {
  await nextTick();
  sections.value = document.querySelectorAll('section');
  images.value = document.querySelectorAll('.bg');
  headings.value = gsap.utils.toArray('.section-heading');
  continueScrollings.value = gsap.utils.toArray('.continue-scrolling');
  outerWrappers.value = gsap.utils.toArray('.outer');
  innerWrappers.value = gsap.utils.toArray('.inner');
  splitHeadings.value = headings.value.map(
    (heading) => new SplitText(heading, { type: 'chars,words,lines', linesClass: 'clip-text' })
  );

  splitContinueScrollings.value = continueScrollings.value.map(
    (scrollContinue) => new SplitText(scrollContinue, { type: 'chars,words,lines', linesClass: 'clip-text' })
  );

  gsap.set(outerWrappers.value, { yPercent: 100 });
  gsap.set(innerWrappers.value, { yPercent: -100 });

  observerInstance = Observer.create({
    type: 'wheel,touch,pointer',
    wheelSpeed: -1,
    onDown: () => !animating.value && gotoSection(currentIndex.value - 1, -1),
    onUp: () => !animating.value && gotoSection(currentIndex.value + 1, 1),
    tolerance: 10,
    preventDefault: true,
  });

  window.addEventListener('keydown', onKeyDown);

  gotoSection(0, 1);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  observerInstance.kill();
  splitHeadings.value.forEach((split) => split.revert());
  splitContinueScrollings.value.forEach((split) => split.revert());
});

const wrap = (index, max) => (index + max) % max;

// Keyboard navigation: mirrors the Observer wheel behaviour (down = next slide, up = previous slide).
function onKeyDown(event) {
  const next = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey);
  const prev = ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey);
  if (!next && !prev) return;

  event.preventDefault();
  const direction = next ? 1 : -1;
  if (animating.value) {
    pendingDirection = direction;
    return;
  }

  gotoSection(currentIndex.value + direction, direction);
}

// Called when the slide movement finishes: accept input again and replay a queued key press.
function onSlideSettled() {
  animating.value = false;
  if (pendingDirection) {
    const direction = pendingDirection;
    pendingDirection = 0;
    gotoSection(currentIndex.value + direction, direction);
  }
}

// Initial inspiration from https://codepen.io/BrianCross/pen/PoWapLP, then heavily modified by me for use in Vue, multiple background images, and other tweaks.
function gotoSection(index, direction) {
  index = wrap(index, sections.value.length);
  animating.value = true;

  // Input is accepted as soon as the slide settles, while the previous transition may still be
  // finishing its text animation and its deferred "hide the outgoing slide" step. Stop it and apply
  // that hide now, unless the outgoing slide is exactly where we are heading back to.
  if (activeTimeline) {
    activeTimeline.kill();
    activeTimeline = null;
    if (outgoingIndex >= 0 && outgoingIndex !== index) {
      gsap.set(sections.value[outgoingIndex], { autoAlpha: 0, zIndex: 0 });
    }
  }
  outgoingIndex = currentIndex.value;

  if (scrollCount.value < bgImages.value.length) {
    const newBgImage = bgImages.value[scrollCount.value];

    // Update the background image of the current section
    gsap.set(images.value[index], {
      backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 100%), url(${newBgImage})`,
    });

    scrollCount.value++;
  } else {
    // Reset scroll count
    scrollCount.value = 0;
    const newBgImage = bgImages.value[scrollCount.value];

    // Update the background image of the current section
    gsap.set(images.value[index], {
      backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 100%), url(${newBgImage})`,
    });
  }

  let fromTop = direction === -1,
    dFactor = fromTop ? -1 : 1,
    tl = gsap.timeline({
      defaults: { duration: motion.duration, ease: 'power1.inOut' },
    });
  activeTimeline = tl;
  if (currentIndex.value >= 0) {
    gsap.set(sections.value[currentIndex.value], { zIndex: 0 });
    tl.to(images.value[currentIndex.value], { yPercent: -15 * dFactor }).set(sections.value[currentIndex.value], {
      autoAlpha: 0,
    });
  }
  gsap.set(sections.value[index], { autoAlpha: 1, zIndex: 1 });
  tl.fromTo(
    [outerWrappers.value[index], innerWrappers.value[index]],
    {
      yPercent: (i) => (i ? -100 * dFactor : 100 * dFactor),
    },
    {
      yPercent: 0,
    },
    0
  )
    .fromTo(images.value[index], { yPercent: 15 * dFactor }, { yPercent: 0 }, 0)
    .fromTo(
      splitHeadings.value[index].chars,
      {
        autoAlpha: 0,
        yPercent: 150 * dFactor,
      },
      {
        autoAlpha: 1,
        yPercent: 0,
        duration: motion.charDuration,
        ease: 'power2',
        stagger: {
          amount: motion.staggerAmount,
          from: 'random',
        },
      },
      motion.charDelay
    )
    .fromTo(
      splitContinueScrollings.value[index].chars,
      {
        autoAlpha: 0,
        yPercent: 150 * dFactor,
      },
      {
        autoAlpha: 1,
        yPercent: 0,
        duration: motion.charDuration,
        ease: 'power2',
        stagger: {
          amount: motion.staggerAmount,
          from: 'random',
        },
      },
      motion.charDelay
    );

  // The character entrance runs past the slide movement; unlock input when the slide itself has settled.
  tl.add(onSlideSettled, motion.duration);

  currentIndex.value = index;

  // Warm the next background image so the following slide never paints without one.
  new Image().src = bgImages.value[scrollCount.value % bgImages.value.length];
}
</script>

<template>
  <HeaderSection />
  <HeroSection />
</template>

<style scoped></style>
