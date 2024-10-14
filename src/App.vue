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

let observerInstance = null;

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

  gotoSection(0, 1);
});

onUnmounted(() => {
  observerInstance.kill();
  splitHeadings.value.forEach((split) => split.destroy());
  splitContinueScrollings.value.forEach((split) => split.destroy());
});

const wrap = (index, max) => (index + max) % max;

function gotoSection(index, direction) {
  index = wrap(index, sections.value.length);
  animating.value = true;
  let fromTop = direction === -1,
    dFactor = fromTop ? -1 : 1,
    tl = gsap.timeline({
      defaults: { duration: 1.25, ease: 'power1.inOut' },
      onComplete: () => (animating.value = false),
    });
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
        duration: 1,
        ease: 'power2',
        stagger: {
          each: 0.02,
          from: 'random',
        },
      },
      0.2
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
        duration: 1,
        ease: 'power2',
        stagger: {
          each: 0.02,
          from: 'random',
        },
      },
      0.2
    );

  currentIndex.value = index;
}
</script>

<template>
  <HeaderSection />
  <HeroSection />
</template>

<style scoped></style>
