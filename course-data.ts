export type ModuleName = 'Introduction' | 'Illustrations' | 'Animations' | 'Prototypes';

export interface CourseModule {
  id: string;
  title: ModuleName;
  description: string;
  lessonIds: string[];
}

export interface LearningTask {
  id: string;
  title: string;
  description: string;
}

export interface Lesson {
  id: string;
  number: number;
  module: ModuleName;
  title: string;
  subtitle: string;
  summary: string[];
  objectives: string[];
  vocabulary: { term: string; definition: string }[];
  videoId: string;
  companionUrl: string;
  sourceAnchor: string;
  tasks: LearningTask[];
  deliverable: string;
  criteria: string[];
  reflectionPrompt: string;
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  extension: string;
  troubleshooting: { problem: string; solution: string }[];
}

export const courseSource = 'https://www.figma.com/resource-library/k-12-design-basics/';

export const courseModules: CourseModule[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    description: 'Build your foundation with frames, shapes, and type.',
    lessonIds: ['frames', 'shapes', 'typography'],
  },
  {
    id: 'illustrations',
    title: 'Illustrations',
    description: 'Turn simple geometry into original icons and expressive artwork.',
    lessonIds: ['geometry', 'pen', 'brushes'],
  },
  {
    id: 'animations',
    title: 'Animations',
    description: 'Make your designs grow, move, loop, and respond.',
    lessonIds: ['animation', 'loading'],
  },
  {
    id: 'prototypes',
    title: 'Prototypes',
    description: 'Connect your skills in scrollable, clickable digital experiences.',
    lessonIds: ['prototype-1', 'prototype-2'],
  },
];

export const setupSteps = [
  {
    title: 'Get your Figma workspace ready',
    description: 'Use the Figma account and school access Mr. Romine has approved. If you cannot sign in or open a file, ask for help before creating a different account.',
  },
  {
    title: 'Make your own working copy',
    description: 'Each lesson has an official Figma Community companion file. Open it, then use the available option to open or duplicate a copy into your own workspace. Keep the original example separate from your practice.',
  },
  {
    title: 'Use a clear file name',
    description: 'Name each working file with the lesson number, topic, and the student name or identifier Mr. Romine asks you to use. For example: 01 — Frames — Carter.',
  },
  {
    title: 'Watch, pause, and try it',
    description: 'Watch the official tutorial in small sections, pause to try the tools in Figma, then complete the classroom practice checklist. The checklist and reflection are class activities added to help you use the skills.',
  },
  {
    title: 'Save your place before leaving',
    description: 'You can take more than one class period for a lesson. Keep your Figma work saved, record which tasks are finished, and leave yourself a short next-step note so you know where to begin next time.',
  },
  {
    title: 'Share your work as directed',
    description: 'Copy the link to your own Figma file when a lesson asks for evidence. Give Mr. Romine access using the school-approved sharing setting. Saving a link here does not automatically submit it to Google Classroom.',
  },
];

export const lessons: Lesson[] = [
  {
    id: 'frames',
    number: 1,
    module: 'Introduction',
    title: 'Using frames',
    subtitle: 'Give every design a place to begin.',
    summary: [
      'A frame is a container for a design. It can hold text, shapes, images, and smaller frames, so you can organize a complete screen or page in one place. Choosing a frame size helps you plan for the device or format your audience will use, such as a phone screen, website, or digital flyer.',
      'Frames also support layout grids, constraints, and Auto Layout. Grids help you line things up; constraints describe how an item should respond when its parent frame changes size; Auto Layout helps arrange and space content. These tools make designs easier to adjust. You will start with frames and use them to organize a simple digital page.',
    ],
    objectives: [
      'Create and name frames for different screen sizes.',
      'Place and organize layers inside a parent frame.',
      'Test a constraint and use a layout aid to improve a design.',
    ],
    vocabulary: [
      { term: 'Frame', definition: 'A container that gives a screen or section its own space, dimensions, and layout settings.' },
      { term: 'Constraint', definition: 'A rule for how a layer responds when its parent frame is resized.' },
      { term: 'Layout grid', definition: 'A visual guide that helps align elements and keep spacing consistent.' },
      { term: 'Auto Layout', definition: 'A layout system that arranges content and spacing inside a frame.' },
    ],
    videoId: 'dXZB0bI6uis',
    companionUrl: 'https://www.figma.com/community/file/1483880004008505056/frames-in-figma-design',
    sourceAnchor: '#_1-using-frames',
    tasks: [
      { id: 'frames-1', title: 'Open and name your working file', description: 'Make your own copy of the companion file. Rename it for this lesson, locate the Layers panel, and find a frame from the example.' },
      { id: 'frames-2', title: 'Create two frames for different screens', description: 'Create one phone-sized frame and one desktop-sized frame using suitable presets. Name them Phone practice and Desktop practice so you can identify them in the Layers panel.' },
      { id: 'frames-3', title: 'Build a simple digital flyer', description: 'Inside one frame, add a heading, a short message, a colored shape, and a smaller frame for a callout. Use a school event or club as your theme. Check that the items belong to the intended frame in the Layers panel.' },
      { id: 'frames-4', title: 'Try a layout grid', description: 'Add a layout grid to your main frame and use it to align the heading, message, and callout. Adjust the arrangement so the content has consistent space around the edges.' },
      { id: 'frames-5', title: 'Test a constraint by resizing', description: 'Select a shape inside a regular frame and set a useful constraint, such as staying attached to the right edge. Resize the parent frame to see the result. Adjust the setting if the layer moves differently than you intended.' },
      { id: 'frames-6', title: 'Explore an organized content group', description: 'Use the tutorial to try Auto Layout on a small set of items, such as two label cards. Change one label and observe how spacing behaves. Keep a short note beside your practice explaining how frames, constraints, and Auto Layout help in different ways.' },
    ],
    deliverable: 'A saved Figma file with two named screen frames, a simple digital flyer, and visible practice with a grid, a constraint, and Auto Layout.',
    criteria: [
      'Two frames have clear names and sizes chosen for different screens.',
      'The flyer contains organized text, a shape, and a nested frame.',
      'A layout grid helps align the content.',
      'You tested a constraint by resizing and can explain the result.',
      'A small Auto Layout example shows organized spacing.',
    ],
    reflectionPrompt: 'Which item changed when you resized its frame, and how did its constraint affect what happened?',
    quiz: {
      question: 'You want a button to stay near the right edge when its parent frame becomes wider. What should you investigate?',
      options: ['The font family', 'The button’s constraint settings', 'The file’s name', 'The image export format'],
      correctIndex: 1,
      explanation: 'Constraints describe how a layer responds when its parent frame changes size. A right constraint can keep a layer attached to the right edge.',
    },
    extension: 'Turn the flyer into the beginning of a class newsletter by adding a second content section. Plan how someone would read the page from top to bottom.',
    troubleshooting: [
      { problem: 'My shape is not moving with the frame.', solution: 'Check the Layers panel. The shape may be beside the frame in the layer list instead of nested inside it. Move it into the intended frame, then test again.' },
      { problem: 'The resize behavior does not match the example.', solution: 'Select the actual child layer and inspect its parent. Auto Layout uses its own sizing behavior, so practice the constraint example inside a regular frame first.' },
    ],
  },
  {
    id: 'shapes',
    number: 2,
    module: 'Introduction',
    title: 'Using shapes',
    subtitle: 'Make more from the simplest building blocks.',
    summary: [
      'Rectangles, ellipses, polygons, and stars can become much more than basic shapes. When you combine and arrange them, you can build icons, logos, characters, and illustrations. Figma shapes are vector graphics, so their paths stay sharp when you resize them.',
      'Pixel images such as JPEGs and PNGs are made from a fixed grid of pixels and can look blurry when enlarged too far. Vector shapes are useful when a design needs to work at many sizes. In this lesson, you will explore the shape tools and create two geometric illustrations.',
    ],
    objectives: [
      'Create and edit several types of vector shapes.',
      'Use size, color, rotation, and layer order to build an image.',
      'Create two recognizable illustrations from simple geometry.',
    ],
    vocabulary: [
      { term: 'Vector', definition: 'A graphic described by paths and shapes that can scale without pixelation.' },
      { term: 'Raster image', definition: 'An image made from pixels, such as a JPEG or PNG.' },
      { term: 'Fill', definition: 'The color or other content displayed inside a shape.' },
      { term: 'Layer order', definition: 'The order that determines which objects appear in front of or behind others.' },
    ],
    videoId: 'm6utW8cghJI',
    companionUrl: 'https://www.figma.com/community/file/1485052588133615152/using-shapes-in-figma-design',
    sourceAnchor: '#_2-using-shapes',
    tasks: [
      { id: 'shapes-1', title: 'Set up a shape playground', description: 'Make a working copy of the companion file. Create a practice frame and add a rectangle, ellipse, polygon, and star. Try changing each shape’s size, fill, and rotation.' },
      { id: 'shapes-2', title: 'Practice arranging and layering', description: 'Overlap three shapes and change their front-to-back order. Duplicate a shape and align the copies so you can see how arrangement changes the picture.' },
      { id: 'shapes-3', title: 'Build your first geometric illustration', description: 'Follow the tutorial’s approach to build a recognizable object or scene with several shapes. Use a limited color palette and name the layers or groups so the work is easy to understand.' },
      { id: 'shapes-4', title: 'Create a second illustration', description: 'Build a different object, character, or scene in a second frame. Reuse the same tools, but make your own choices about shapes, color, and composition.' },
      { id: 'shapes-5', title: 'Test a small and large version', description: 'Duplicate one completed illustration and resize it. Zoom in to inspect the shape edges. Adjust any spacing or proportions that make the smaller version hard to recognize.' },
      { id: 'shapes-6', title: 'Polish the pair', description: 'Give both illustrations clear names, align the important parts, and remove stray practice shapes from the final frames. Leave your tool experiments in a separate practice area.' },
    ],
    deliverable: 'Two finished geometric illustrations in named frames, with a separate shape-tool practice area.',
    criteria: [
      'Both illustrations are built from editable vector shapes.',
      'You use several kinds of shapes and intentional layer order.',
      'The two illustrations are recognizable and visually organized.',
      'You tested an illustration at a different size.',
    ],
    reflectionPrompt: 'Choose one part of your illustration. Which basic shapes did you combine to make it, and why did those shapes work?',
    quiz: {
      question: 'Why are vector shapes useful for a logo that must appear both small and large?',
      options: ['They always use fewer colors.', 'They automatically create an animation.', 'Their paths stay sharp when resized.', 'They can only be used inside phone frames.'],
      correctIndex: 2,
      explanation: 'Vector graphics use paths rather than a fixed grid of pixels, so the edges can stay sharp at different sizes.',
    },
    extension: 'Design a third illustration that belongs to the same collection by reusing your palette and shape style.',
    troubleshooting: [
      { problem: 'An important shape has disappeared.', solution: 'Look for it in the Layers panel. It may be underneath another object. Move it forward or change the arrangement.' },
      { problem: 'My illustration becomes stretched.', solution: 'Check whether its width and height were changed independently. Keep the intended proportions when resizing, then inspect the spacing between parts.' },
    ],
  },
  {
    id: 'typography',
    number: 3,
    module: 'Introduction',
    title: 'Typography basics',
    subtitle: 'Help your audience know what to read first.',
    summary: [
      'Typography is the way you choose and arrange letters and words. Font choice, size, weight, spacing, and placement affect both the personality of a design and how easy it is to read. Good typography makes a message clear instead of making the reader work to find it.',
      'Type also creates hierarchy: a clear order of importance. A strong headline draws attention, while supporting information gives the reader what they need next. You will use Figma’s text tools to create a social media post with a clear message, deliberate visual rhythm, and readable details.',
    ],
    objectives: [
      'Edit font, size, weight, spacing, and alignment.',
      'Create a clear hierarchy between a headline and supporting details.',
      'Design a readable social post for a specific message.',
    ],
    vocabulary: [
      { term: 'Typography', definition: 'The practice of selecting and arranging type to communicate clearly.' },
      { term: 'Hierarchy', definition: 'The visual order that helps a reader understand what matters first, second, and next.' },
      { term: 'Font weight', definition: 'How light or heavy the strokes of the letters appear.' },
      { term: 'Line height', definition: 'The spacing between lines of text.' },
    ],
    videoId: 'QeT7eydBrJ4',
    companionUrl: 'https://www.figma.com/community/file/1506689685069558781',
    sourceAnchor: '#_3-typography-basics',
    tasks: [
      { id: 'typography-1', title: 'Choose a clear message', description: 'Copy the companion file and choose a school-appropriate event, club, or announcement for a practice social post. Write the headline and two or three useful details before styling them. You do not need to post it on social media.' },
      { id: 'typography-2', title: 'Compare type treatments', description: 'Create a small text practice area. Try different fonts, weights, and sizes using the same phrase. Choose a treatment that fits your message and is easy to read.' },
      { id: 'typography-3', title: 'Create three levels of hierarchy', description: 'Build a headline, supporting line, and small detail line in your post frame. Use size, weight, or placement to make their order of importance obvious.' },
      { id: 'typography-4', title: 'Tune the spacing and alignment', description: 'Adjust line height, letter spacing where useful, and alignment. Leave comfortable space between sections and keep related information together.' },
      { id: 'typography-5', title: 'Check the post at viewing size', description: 'Zoom out so the post is closer to the size someone might see on a screen. Check whether the headline is obvious and the smaller details are readable. Improve contrast or simplify text if needed.' },
      { id: 'typography-6', title: 'Get a quick reader check', description: 'Ask a classmate which words they noticed first and what the post is asking them to understand. Use that feedback to make one revision, then save the finished post.' },
    ],
    deliverable: 'A finished social post with a clear headline, readable supporting details, and a small type exploration area.',
    criteria: [
      'The post communicates one clear message.',
      'The headline, supporting text, and details have distinct visual roles.',
      'Spacing, alignment, and contrast support readability.',
      'You made a revision after checking how someone reads the post.',
    ],
    reflectionPrompt: 'What should a viewer read first, second, and third in your post? Explain which type choices create that order.',
    quiz: {
      question: 'Your post’s date is more visually prominent than its main message. Which design issue should you address?',
      options: ['The frame’s file name', 'The video playback speed', 'The vector point count', 'The typography hierarchy'],
      correctIndex: 3,
      explanation: 'Hierarchy sets the reading order. Adjusting text size, weight, spacing, or placement can help the main message receive the right emphasis.',
    },
    extension: 'Make a second version using the same words but a different mood. Compare how your font and spacing choices change the tone.',
    troubleshooting: [
      { problem: 'My text is cut off or wraps unexpectedly.', solution: 'Select the text layer and inspect its text-box size and resizing behavior. Give the text enough room, then check line breaks again.' },
      { problem: 'The design looks busy.', solution: 'Reduce the number of competing fonts or weights, align related information, and leave more space around your main message.' },
    ],
  },
  {
    id: 'geometry',
    number: 4,
    module: 'Illustrations',
    title: 'Drawing with geometry',
    subtitle: 'Combine familiar shapes into something original.',
    summary: [
      'Boolean operations let you combine or cut overlapping shapes to make new forms. You can merge shapes, remove one shape’s area from another, keep only their overlap, or exclude the overlapping area. This gives you a quick way to build custom icons from simple geometry.',
      'Shape-based image fills and vector editing add more possibilities. A shape can hold an image, and points on a vector can be adjusted to refine its outline. These techniques can help you create a classroom badge, an avatar, or a portfolio icon. You will make a coordinated set of custom icons using shape combinations and an image fill.',
    ],
    objectives: [
      'Compare the results of different boolean operations.',
      'Use combined shapes to create a custom icon set.',
      'Add an image fill and refine a vector detail.',
    ],
    vocabulary: [
      { term: 'Boolean operation', definition: 'A way to combine overlapping shapes by keeping or removing selected areas.' },
      { term: 'Union', definition: 'An operation that combines the filled areas of selected shapes.' },
      { term: 'Subtract', definition: 'An operation that cuts the area of one shape out of another.' },
      { term: 'Image fill', definition: 'An image displayed inside the boundary of a shape.' },
    ],
    videoId: '5pYzyN_idJk',
    companionUrl: 'https://www.figma.com/community/file/1488679646533208800/drawing-with-geometry-in-figma-design',
    sourceAnchor: '#_1-drawing-with-geometry',
    tasks: [
      { id: 'geometry-1', title: 'Compare shape operations', description: 'Copy the companion file. In a practice area, duplicate a pair of overlapping shapes so you can test Union, Subtract, Intersect, and Exclude. Label the results in your own words.' },
      { id: 'geometry-2', title: 'Pick a theme for your icons', description: 'Choose three related ideas, such as creative tools, school subjects, or app features. Sketch how circles, rectangles, or other shapes could represent each idea.' },
      { id: 'geometry-3', title: 'Build three custom icons', description: 'Create one icon for each idea using geometric shapes. Use at least two different boolean operations across the set. Inspect each result and adjust layer order if a cutout appears in the wrong place.' },
      { id: 'geometry-4', title: 'Use an image inside a shape', description: 'Add an image fill to a badge, avatar, or related shape in your design. Use a school-appropriate image you are allowed to use, then adjust its placement so the important part is visible.' },
      { id: 'geometry-5', title: 'Refine one vector detail', description: 'Use vector editing on an appropriate practice shape to adjust a point or edge. Compare the result with the original and keep the version that communicates the idea more clearly.' },
      { id: 'geometry-6', title: 'Present a consistent collection', description: 'Arrange the icons at a consistent size with even spacing. Use a shared palette or visual style, name the icons, and keep your operation experiments separate from the final set.' },
    ],
    deliverable: 'Three coordinated custom icons, one shape-based image fill, and a labeled comparison of the boolean operations.',
    criteria: [
      'The final set includes three related custom icons.',
      'At least two boolean operation types contribute to the finished work.',
      'An image is fitted intentionally inside a shape.',
      'One vector detail has been refined.',
      'Icon sizes, spacing, and style make the set feel connected.',
    ],
    reflectionPrompt: 'Which boolean operation was most useful for one of your icons? Describe what it kept or removed.',
    quiz: {
      question: 'You place a small circle over a larger circle and want to cut the small circle’s area out of the larger one. Which operation fits?',
      options: ['Subtract', 'Union', 'Add a text layer', 'Change the page name'],
      correctIndex: 0,
      explanation: 'Subtract removes the area of one shape from another. Layer order matters because it affects which shape cuts into the other.',
    },
    extension: 'Use your icon set to create a small classroom badge system with a different badge for each skill.',
    troubleshooting: [
      { problem: 'Subtract removes the opposite area from what I expected.', solution: 'Inspect which shape is above the other in the Layers panel. Change the order and compare the result.' },
      { problem: 'The image is cropped in an awkward way.', solution: 'Select the shape’s image fill and adjust the image position or fitting mode. Keep the part that matters inside the visible boundary.' },
    ],
  },
  {
    id: 'pen',
    number: 5,
    module: 'Illustrations',
    title: 'Drawing with the pen tool',
    subtitle: 'Build your own lines, curves, and character.',
    summary: [
      'The Pen tool builds custom paths from points. Straight segments connect points directly, while curves use handles to control their direction and shape. This lets you create precise drawings, trace an outline, or make an original icon instead of relying only on preset shapes.',
      'A collection of icons should feel like a family. Consistent proportions, stroke weight, corner style, and spacing help separate drawings belong together. In this lesson, you will practice controlling points and curves, then draw a matching set of icons.',
    ],
    objectives: [
      'Draw open and closed paths with the Pen tool.',
      'Adjust points and handles to control straight and curved segments.',
      'Create an evenly spaced icon set with a consistent visual style.',
    ],
    vocabulary: [
      { term: 'Path', definition: 'A connected series of line or curve segments in a vector drawing.' },
      { term: 'Point', definition: 'A location that helps define the structure and direction of a vector path.' },
      { term: 'Handle', definition: 'A control used to change the direction and shape of a curve.' },
      { term: 'Stroke', definition: 'The visible line drawn along a path or shape outline.' },
    ],
    videoId: 'cke01gWWwyo',
    companionUrl: 'https://www.figma.com/community/file/1488944968858451812/drawing-with-the-pen-tool-in-figma-design',
    sourceAnchor: '#_2-drawing-with-the-pen-tool',
    tasks: [
      { id: 'pen-1', title: 'Practice straight paths', description: 'Make a copy of the companion file. Use the Pen tool to draw an open line with several straight segments, then create a closed shape by returning to its starting point.' },
      { id: 'pen-2', title: 'Practice curved paths', description: 'Draw a curve using the technique in the tutorial. Adjust its points and handles to see how they change the outline. Keep a before-and-after example in your practice area.' },
      { id: 'pen-3', title: 'Set rules for an icon family', description: 'Choose three related icons. Decide on a shared approximate size, stroke weight, and corner style before you draw them.' },
      { id: 'pen-4', title: 'Draw three original icons', description: 'Use Pen-tool paths to build all three icons. Include straight and curved segments across the set. Use a simple outline or your own sketch as a guide if that helps.' },
      { id: 'pen-5', title: 'Refine the points and curves', description: 'Inspect the icons closely for accidental bumps, gaps, or unnecessary points. Adjust the paths so each icon is recognizable without extra visual clutter.' },
      { id: 'pen-6', title: 'Align and test your icon set', description: 'Arrange the icons with even spacing and a consistent visual size. View them smaller to check readability, then make a final adjustment to help them look like one collection.' },
    ],
    deliverable: 'A coordinated set of three Pen-tool icons, plus practice examples showing straight paths and adjusted curves.',
    criteria: [
      'All three icons include editable Pen-tool paths.',
      'The work demonstrates both straight and curved segments.',
      'Stroke, proportions, and corner choices are consistent.',
      'The icons are evenly spaced and recognizable at a smaller size.',
    ],
    reflectionPrompt: 'What changed when you adjusted a curve’s handle? Explain one adjustment that improved an icon.',
    quiz: {
      question: 'A curved section of your icon bends too sharply. What can you adjust to refine it?',
      options: ['The video title', 'The page background only', 'The path’s points and curve handles', 'The file-sharing link'],
      correctIndex: 2,
      explanation: 'Points and handles control a vector curve’s shape. Changing their positions or directions can make the curve smoother or more deliberate.',
    },
    extension: 'Create a fourth icon with the same style rules. Ask a classmate whether it looks like it belongs in the original set.',
    troubleshooting: [
      { problem: 'My path keeps adding extra segments.', solution: 'Finish or exit the current path before starting another one. Select the finished path again when you want to edit its points.' },
      { problem: 'My icons do not feel consistent.', solution: 'Compare their stroke weights, visual size, and corner styles side by side. Use one icon as a reference and adjust the others to match its rules.' },
    ],
  },
  {
    id: 'brushes',
    number: 6,
    module: 'Illustrations',
    title: 'Drawing with vector brushes and effects',
    subtitle: 'Give a clean vector design a personal touch.',
    summary: [
      'Figma Draw brings illustration tools into the Figma Design editor. Switching to its drawing workspace changes the tools available so you can focus on freeform artwork. Vector brushes, texture fills, and dynamic strokes help create a hand-drawn feeling while keeping the work editable.',
      'Brush and effect choices can suggest movement, energy, or a particular mood. Texture can add character, while blur or other effects can change how an element feels. You will explore different brush treatments and line styles, then create a custom logo that combines those experiments with a clear underlying design.',
    ],
    objectives: [
      'Explore the illustration tools available in Figma Draw.',
      'Compare vector brushes, textures, and dynamic stroke styles.',
      'Create an original logo using an intentional drawing treatment.',
    ],
    vocabulary: [
      { term: 'Vector brush', definition: 'A drawing treatment that gives an editable vector stroke a particular appearance.' },
      { term: 'Texture', definition: 'A visual surface treatment that adds detail or a tactile quality to a design.' },
      { term: 'Dynamic stroke', definition: 'A line whose visual character can vary, creating a more expressive result.' },
      { term: 'Effect', definition: 'An appearance treatment, such as blur, applied to a design element.' },
    ],
    videoId: 'AUSZHj17bzY',
    companionUrl: 'https://www.figma.com/community/file/1509694322217243479',
    sourceAnchor: '#_3-drawing-with-vector-brushes-and-effects',
    tasks: [
      { id: 'brushes-1', title: 'Explore the drawing workspace', description: 'Copy the companion file and follow the tutorial to enter Figma Draw. Locate the drawing tools and notice how the toolbar and side panels differ from your earlier lessons.' },
      { id: 'brushes-2', title: 'Make a brush sample sheet', description: 'Draw several similar lines or marks using different available brush styles. Label the samples so you can compare how each changes the feeling of the same basic stroke.' },
      { id: 'brushes-3', title: 'Experiment with texture and line character', description: 'Try a texture treatment and a dynamic stroke adjustment. Compare the original and edited versions. Keep the experiments readable so you can explain the difference.' },
      { id: 'brushes-4', title: 'Explore an effect', description: 'Apply an available effect, such as blur, to a practice element. Change its strength and decide when it helps the design and when it hides too much detail.' },
      { id: 'brushes-5', title: 'Design an original logo', description: 'Create a logo for a fictional club, creative project, or school-appropriate brand. Combine a simple symbol or lettering with an intentional brush or texture treatment from your experiments.' },
      { id: 'brushes-6', title: 'Check and present your logo', description: 'View the logo at both a larger and smaller size. Simplify any texture that makes it difficult to recognize. Place the final logo in its own named frame beside your sample sheet.' },
    ],
    deliverable: 'An original logo and a sample sheet showing brush styles, texture or dynamic stroke experiments, and an effect comparison.',
    criteria: [
      'The sample sheet compares several brush treatments.',
      'You explored texture, dynamic stroke behavior, and an effect.',
      'The logo combines a clear idea with an intentional illustration treatment.',
      'The finished logo remains recognizable at a smaller size.',
    ],
    reflectionPrompt: 'Which brush or texture choice best fits your logo’s personality, and how did you keep the result readable?',
    quiz: {
      question: 'A texture looks exciting up close but makes your small logo difficult to recognize. What is the strongest next step?',
      options: ['Add more textures everywhere.', 'Simplify or reduce the texture and test the logo again.', 'Ignore the smaller version.', 'Delete the logo’s main shape.'],
      correctIndex: 1,
      explanation: 'A treatment should support the design’s purpose. Reducing texture can preserve personality while helping the logo remain clear at its actual viewing size.',
    },
    extension: 'Create a second logo variation that suggests a different mood, then compare which brush and effect choices caused the change.',
    troubleshooting: [
      { problem: 'I cannot find the drawing tools shown in the tutorial.', solution: 'Check that you are working in your own editable copy, then switch to the Draw tools in the editor. If the tools still do not appear, ask Mr. Romine to help you find the current controls.' },
      { problem: 'The logo looks muddy or hard to read.', solution: 'Reduce the number or strength of effects. Check the design at a smaller size and keep the main silhouette clear.' },
    ],
  },
  {
    id: 'animation',
    number: 7,
    module: 'Animations',
    title: 'Building simple animations',
    subtitle: 'Turn a change between frames into motion.',
    summary: [
      'Smart Animate creates transitions between matching layers in different frames. When the matching layers change size, position, rotation, or supported appearance settings, Figma can animate those changes. You can create motion without writing code by designing states and connecting them in a prototype.',
      'Animation can communicate an idea: a growing shape can suggest progress, a position change can suggest travel, and a coordinated style change can suggest connection. You will create three short examples that explore growth, movement, and changes in color or corner radius.',
    ],
    objectives: [
      'Create two states with matching layers for Smart Animate.',
      'Animate size, position, and appearance changes.',
      'Test a prototype and adjust motion to communicate clearly.',
    ],
    vocabulary: [
      { term: 'Smart Animate', definition: 'A Figma transition that animates differences between matching layers in frames.' },
      { term: 'State', definition: 'One version of a design at a particular point in an interaction or animation.' },
      { term: 'Trigger', definition: 'The event, such as a click, that starts a prototype interaction.' },
      { term: 'Duration', definition: 'The amount of time a transition takes to play.' },
    ],
    videoId: 'Ygjw4henJcY',
    companionUrl: 'https://www.figma.com/community/file/1491895971818453542/building-simple-animations-in-figma-design',
    sourceAnchor: '#_1-building-simple-animations',
    tasks: [
      { id: 'animation-1', title: 'Prepare matching animation states', description: 'Copy the companion file. Create a frame with a clearly named shape, duplicate the frame, and inspect how matching layer names and structure carry into the copy.' },
      { id: 'animation-2', title: 'Animate growth', description: 'Change the shape’s size in the second state. Connect the frames in Prototype mode using Smart Animate and the tutorial’s interaction approach. Preview the transition and check that the shape grows smoothly.' },
      { id: 'animation-3', title: 'Animate a position change', description: 'Create a separate two-state example in which a shape moves from one position to another. Keep its matching layer identity clear, then connect and preview the states.' },
      { id: 'animation-4', title: 'Animate a style change', description: 'Make a third example that changes fill color and corner radius between states. Use the arrangement or motion to suggest an idea such as parts coming together.' },
      { id: 'animation-5', title: 'Adjust the motion', description: 'Test the examples in Present mode. Compare a faster and slower transition or different easing choices, then choose settings that make each change easy to follow.' },
      { id: 'animation-6', title: 'Label and demonstrate the three examples', description: 'Name each animation and its starting frame. Keep the three examples organized and confirm that a classmate can start each one and see the intended effect.' },
    ],
    deliverable: 'Three working Smart Animate examples showing growth, a position change, and a change in color or corner radius.',
    criteria: [
      'All three examples play in the prototype viewer.',
      'Matching layer names and structure support the transitions.',
      'The examples show size, position, and appearance changes.',
      'Timing choices make the intended motion easy to follow.',
    ],
    reflectionPrompt: 'Choose one animation. What idea does its motion communicate, and how did changing its timing affect that idea?',
    quiz: {
      question: 'A shape fades away and a new one appears instead of moving smoothly. What should you check first?',
      options: ['Whether the matching layers have consistent names and hierarchy', 'Whether the file has a longer title', 'Whether the background is white', 'Whether the shape was exported as a PNG'],
      correctIndex: 0,
      explanation: 'Smart Animate needs to identify matching layers across states. Consistent names and hierarchy help it recognize which layer should change.',
    },
    extension: 'Combine two types of change in a short animated introduction for a fictional club or classroom project.',
    troubleshooting: [
      { problem: 'The shape jumps or dissolves instead of animating.', solution: 'Confirm that the transition uses Smart Animate and that the layers match in name and hierarchy. Duplicating the original frame can help preserve that structure.' },
      { problem: 'Nothing happens when I preview.', solution: 'Check the starting frame, the interaction trigger, and the connection to the destination frame. Test the exact action your trigger expects.' },
    ],
  },
  {
    id: 'loading',
    number: 8,
    module: 'Animations',
    title: 'Making loading animations',
    subtitle: 'Use timing and interaction to keep a design moving.',
    summary: [
      'Loading-style animations are a way to practice repeated motion and responsive interaction. Smart Animate can connect a sequence of states so that a design appears to move continuously. Thoughtful timing helps a loop feel smooth instead of pausing or jumping at the end.',
      'You will create two different interactions. First, four colorful elements will move together at the center in a repeating loop. Next, a circle will grow and change color when someone hovers over it. Together, these examples show the difference between an automatic sequence and motion started by the user.',
    ],
    objectives: [
      'Create a looping Smart Animate sequence.',
      'Connect the ending state back to the beginning smoothly.',
      'Create and test a hover interaction that changes size and color.',
    ],
    vocabulary: [
      { term: 'Loop', definition: 'A sequence that returns to its starting point and repeats.' },
      { term: 'After delay', definition: 'A trigger that starts an interaction after a specified waiting period.' },
      { term: 'Hover', definition: 'An interaction caused by moving a pointer over an element.' },
      { term: 'Easing', definition: 'The pattern of speeding up or slowing down during an animation.' },
    ],
    videoId: 'eAg9wgfNDf0',
    companionUrl: 'https://www.figma.com/community/file/1493726916072604339/make-loading-animations-in-figma-design',
    sourceAnchor: '#_2-making-loading-animations',
    tasks: [
      { id: 'loading-1', title: 'Arrange four colorful elements', description: 'Make a working copy of the companion file. Build the starting state with four clearly named colored elements placed around a shared center.' },
      { id: 'loading-2', title: 'Create the center state', description: 'Duplicate the state and move the four elements toward the center using the tutorial’s approach. Preserve matching layer names so Smart Animate can connect the movement.' },
      { id: 'loading-3', title: 'Connect a repeating loop', description: 'Use the tutorial’s sequence and timed triggers to connect the states. Include a path from the ending state back to the starting state so the animation continues without another click.' },
      { id: 'loading-4', title: 'Smooth the repeat', description: 'Preview at least three full cycles. Watch the transition back to the beginning carefully, then adjust timing, easing, or placement to reduce any distracting jump.' },
      { id: 'loading-5', title: 'Build the hover circle', description: 'Create the normal and hovered circle states with different size and color. Set up the hover interaction shown in the tutorial, then move the pointer onto and away from the circle to test the behavior.' },
      { id: 'loading-6', title: 'Present both interaction types', description: 'Keep the automatic loop and hover example in separate labeled areas. Confirm that someone can open the prototype and tell which example runs automatically and which needs their pointer.' },
    ],
    deliverable: 'A repeating animation with four elements and a separate hover interaction in which a circle changes size and color.',
    criteria: [
      'Four colored elements move toward a shared center.',
      'The loop repeats at least three times without another click.',
      'The return to the starting state looks intentional.',
      'The circle responds to hover by changing both size and color.',
    ],
    reflectionPrompt: 'How is the trigger for your loading loop different from the trigger for your hover circle?',
    quiz: {
      question: 'Your animation should repeat on its own while a viewer waits. Which setup best supports that behavior?',
      options: ['Only a hover interaction on the first shape', 'A new file for every frame', 'Timed transitions with a connection back to the beginning', 'A still image exported from the last frame'],
      correctIndex: 2,
      explanation: 'Timed transitions move the sequence forward without another click, and a connection back to the beginning allows the sequence to repeat.',
    },
    extension: 'Try a second timing style for your loop, such as calm or energetic, and compare the feeling without changing the basic shapes.',
    troubleshooting: [
      { problem: 'My loop plays once and stops.', solution: 'Inspect the final state. It needs an appropriate timed interaction that leads back into the repeating sequence.' },
      { problem: 'The hover example does not react.', solution: 'Test it in the prototype viewer with a mouse or trackpad. Check that the hover trigger is attached to the intended element and connected to the correct state.' },
    ],
  },
  {
    id: 'prototype-1',
    number: 9,
    module: 'Prototypes',
    title: 'Prototyping Level 1',
    subtitle: 'Make a page people can actually explore.',
    summary: [
      'A prototype lets someone try how a design works before it becomes a finished product. Instead of looking only at a static screen, a viewer can scroll, click, and follow a flow. Designers use prototypes to communicate ideas and find confusing interactions.',
      'You will create a scrollable Bio Page using text, shapes, images, and color. Auto Layout will help keep the content organized as you edit it. You will also add a clickable element and test the page as a viewer. Use a school-appropriate personal introduction or a fictional profile, with only information you are comfortable sharing for class.',
    ],
    objectives: [
      'Organize a Bio Page using content sections and Auto Layout.',
      'Create a frame with content that scrolls in the prototype.',
      'Add a working clickable element and test the experience.',
    ],
    vocabulary: [
      { term: 'Prototype', definition: 'An interactive model used to explore and test how a design works.' },
      { term: 'Viewport', definition: 'The visible window through which a viewer sees part of a larger design.' },
      { term: 'Overflow', definition: 'Content extending beyond the visible boundaries of a frame.' },
      { term: 'User flow', definition: 'The sequence of actions and screens a person follows to complete a task.' },
    ],
    videoId: 'ZbFOvcGhqtk',
    companionUrl: 'https://www.figma.com/community/file/1499805504590081660/prototyping-in-figma-design-level-1',
    sourceAnchor: '#_1-prototyping-level-1',
    tasks: [
      { id: 'prototype-1-1', title: 'Plan your Bio Page', description: 'Copy the companion file. Plan a heading and at least three content sections, such as an introduction, interests, and projects. Use a first name, class identifier, or fictional character; leave out home addresses, phone numbers, and other private details.' },
      { id: 'prototype-1-2', title: 'Build the visual content', description: 'Add your text, shapes, colors, and a school-appropriate image or avatar. Apply the typography and alignment skills from earlier lessons so the reading order is clear.' },
      { id: 'prototype-1-3', title: 'Organize sections with Auto Layout', description: 'Use Auto Layout to arrange related content and maintain consistent spacing. Change a line of text or add a small item to check how the layout responds.' },
      { id: 'prototype-1-4', title: 'Make the page scroll', description: 'Place enough content inside the page frame to extend beyond the visible viewport. Follow the tutorial to configure vertical scrolling, then test whether a viewer can reach every section.' },
      { id: 'prototype-1-5', title: 'Add a clickable element', description: 'Create a clearly labeled button or link with an appropriate prototype action, such as opening a school-approved resource or moving to a section as demonstrated in the tutorial. Test the action instead of assuming it works.' },
      { id: 'prototype-1-6', title: 'Run a viewer test', description: 'Open the prototype from its intended starting frame. Ask a classmate to find a section and use your clickable element. Fix one issue they notice, then save your final page.' },
    ],
    deliverable: 'A scrollable Bio Page with at least three content sections, organized Auto Layout, and a working clickable element.',
    criteria: [
      'The page combines text, shapes, an image or avatar, and intentional color.',
      'At least three content sections use a clear visual hierarchy.',
      'Auto Layout helps maintain organized spacing.',
      'The prototype scrolls to all content and includes a working click action.',
      'You completed a viewer test and made a useful revision.',
    ],
    reflectionPrompt: 'What did your classmate’s test reveal about the page, and what did you change to make it easier to use?',
    quiz: {
      question: 'Your Bio Page has more content than fits on screen, but the prototype will not scroll. What should you check?',
      options: ['Whether every text layer uses the same font', 'Whether the content extends inside the viewport frame and vertical scrolling is configured', 'Whether the file has been exported as a JPEG', 'Whether the page has an animated logo'],
      correctIndex: 1,
      explanation: 'Scrollable content must belong to the appropriate frame, extend beyond its visible viewport, and have the intended scrolling behavior configured.',
    },
    extension: 'Adapt your Bio Page for a second screen size. Decide what should stay the same and what needs to rearrange.',
    troubleshooting: [
      { problem: 'My page will not scroll in Present mode.', solution: 'Check that the content is inside the intended frame and is taller than its visible viewport. Inspect the frame’s overflow or scrolling settings.' },
      { problem: 'The button looks clickable but does nothing.', solution: 'Select the actual clickable layer and inspect its prototype interaction. Verify the trigger and destination, then test again in the viewer.' },
    ],
  },
  {
    id: 'prototype-2',
    number: 10,
    module: 'Prototypes',
    title: 'Prototyping Level 2',
    subtitle: 'Connect screens into a complete experience.',
    summary: [
      'An effective digital experience connects visual design with behavior. Prototyping lets you plan where a click should lead, how a transition should feel, and how someone finds their way back. It helps you move from separate screen designs to a usable flow.',
      'Building on your Bio Page and animation practice, you will create a photo gallery with clickable images, a detail view, and a working back button. Smooth transitions will help viewers understand the connection between the gallery and the selected image. You will test the complete path so the design feels consistent and easy to explore.',
    ],
    objectives: [
      'Connect a gallery screen to image detail views.',
      'Add animated transitions and a reliable return path.',
      'Test a complete navigation flow with another person.',
    ],
    vocabulary: [
      { term: 'Navigation', definition: 'The controls and connections that help someone move through a digital experience.' },
      { term: 'Transition', definition: 'The way one screen or state changes into another.' },
      { term: 'Detail view', definition: 'A screen that gives more space or information to a selected item.' },
      { term: 'Usability test', definition: 'Watching someone try a design to find what works clearly and what causes confusion.' },
    ],
    videoId: 'XijDqdlEaNs',
    companionUrl: 'https://www.figma.com/community/file/1506435433567455013',
    sourceAnchor: '#_2-prototyping-level-2',
    tasks: [
      { id: 'prototype-2-1', title: 'Plan a gallery flow', description: 'Make a working copy of the companion file. Choose at least three school-appropriate images you are allowed to use. Plan a gallery screen and the detail views someone will reach by selecting the images.' },
      { id: 'prototype-2-2', title: 'Design the gallery and details', description: 'Arrange the images into a clear gallery and create a larger detail view for each one. Reuse your spacing, typography, and color choices so every screen belongs to the same experience.' },
      { id: 'prototype-2-3', title: 'Connect the image interactions', description: 'Make each gallery image clickable and connect it to the correct detail view. Choose clear starting points and labels so you can trace the full flow.' },
      { id: 'prototype-2-4', title: 'Add smooth transitions', description: 'Apply an appropriate animated transition between the gallery and detail views. When using Smart Animate, check matching layer names and hierarchy. Preview the motion and adjust it to support the interaction.' },
      { id: 'prototype-2-5', title: 'Build and test the return path', description: 'Add a clearly labeled back button on every detail view. Connect it so the viewer can return to the main gallery. Test each button from the screen where it appears.' },
      { id: 'prototype-2-6', title: 'Test the complete experience', description: 'Ask a classmate to open an image, return to the gallery, and choose a different image without coaching. Fix any broken or confusing connection, then save your file and prototype link for review.' },
    ],
    deliverable: 'A working photo gallery prototype with at least three clickable images, connected detail views, animated transitions, and back navigation.',
    criteria: [
      'At least three gallery images lead to the intended detail views.',
      'Each detail view provides a working way back to the gallery.',
      'Transitions support the flow and play as intended.',
      'The screens share a consistent visual style.',
      'A classmate can complete the gallery-to-detail-to-gallery flow.',
    ],
    reflectionPrompt: 'Where did your tester hesitate, if anywhere? Explain one change that made your gallery’s navigation or motion clearer.',
    quiz: {
      question: 'A viewer can open every gallery image but gets stuck on a detail screen. What is missing from the experience?',
      options: ['More font families', 'A larger file size', 'Another decorative shape', 'A working return path, such as a back button'],
      correctIndex: 3,
      explanation: 'A complete flow includes a way to leave a detail view and continue exploring. A working back button provides that return path.',
    },
    extension: 'Connect the gallery to your Bio Page as a projects section, then test the full experience from the introduction to the gallery and back.',
    troubleshooting: [
      { problem: 'An image opens the wrong screen.', solution: 'Inspect that image’s prototype connection and confirm its destination. Give frames clear names so similar detail screens are easier to distinguish.' },
      { problem: 'My back button returns somewhere unexpected.', solution: 'Check whether its action uses navigation history or an explicit destination. Choose the behavior that fits your flow and test it from the intended starting frame.' },
    ],
  },
];
