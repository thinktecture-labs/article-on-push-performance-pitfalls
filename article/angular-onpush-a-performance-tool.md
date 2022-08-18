# Angular OnPush - A Performance Tool that should be used with care

### Abstract

>When optimizing the performance of Angular applications, Angular's OnPush Change Detection is an essential tool. However, even the best tool, used incorrectly, can do more harm than good.
In this article, we'll look at what to consider for the successful use of OnPush, when it's worth using it, and which pitfalls we should avoid at all costs to save ourselves tedious debugging sessions.

Before reading the article, if you want to learn more about the basics of Angular's change detection mechanism and the idea behind OnPush, check out the [article of my colleague Max Schulte](https://www.thinktecture.com/angular/whats-the-hype-onpush/). 

## Intro
---
In our daily work, we support our customers in various problems. Of course, the topic of performance optimization is always on the agenda. Many developers in the Angular environment often associate "performance optimization" directly with the term **OnPush**. Accordingly, OnPush is often used in many projects right from the start. But unfortunately, the mere use of OnPush does not guarantee the best possible performance. If misused, it can quickly turn into the opposite and lead to unexpected problems, which may only become apparent much later in the project and are not easy to detect. To help you avoid these pitfalls right from the start, we'll look at the most common sources of errors when using Angular's OnPush Change Detection.

## OnPush - The more the better?
---
One way to use "OnPush" in your project is true to the motto: 

> The more, the better

 Sure, if "OnPush" is suitable for performance, why don't we use it in all components? At first sight, a good approach, isn't it?

Depending on the application and component setup, this approach may not lead to problems directly. But this can change quickly if, for example, graphical components come into play. Let's look at such a case and the associated issues in practice. 

In the following example, I created an Angular application that includes a graphical data picker component. (I took the code for this from the following [repository](https://github.com/hiyali/ng-data-picker) and adapted it a bit to the current Angular version). The change detection is set to OnPush for all components.

// [Stackblitz](https://stackblitz.com/edit/github-jga3rl?file=src/app/child/child.component.html)

However, when we want to use the built-in data picker, we immediately notice that it is unusable. We press the mouse button and move. Nothing happens. Typically, the data wheel should rotate and lock when released. But what is the reason for this?

## A short Changedetection Recap
---
Let's quickly recap the Angular Change Detection or OnPush mechanism to understand the problem better.

Our components form a hierarchical component tree in Angular. When Angular detects changes, the components in the tree are checked and updated from top to bottom.

![cd-cycle]

With OnPush, on the other hand, we detach the component (and all its child components) from this change detection mechanism and only refresh our component when it is marked for a check. (For example, when an `@Input` parameter changes or the `async pipe` triggers a check).

## Continuing the analysis of the problem
---

With this information in mind, let's revisit our problem. Using OnPush on all components, we entirely leverage Angular's default change detection mechanism for our application, which is similar to removing the `NgZone` from our application. Inside the data picker, we listen to the `MouseMoveEvent` when moving the cursor. This will update the graphical representation of the wheel every time the mouse is moved.

````
handleMove(ev): void {
    ev.preventDefault();
    ev.stopPropagation();
    if (this.touchOrMouse.isTouchable || this.touchOrMouse.isMouseDown) {
      this.draggingInfo.isDragging = true;
      this.setCurrentIndexOnMove(ev);
    }
  }

// ...

setCurrentIndexOnMove(ev): void {
    const touchInfo = this.getTouchInfo(ev);
    if (this.draggingInfo.groupIndex === null) {
      this.draggingInfo.groupIndex = this.getGroupIndexBelongsEvent(ev);
    }
    const gIndex = this.draggingInfo.groupIndex;
    if (typeof gIndex === 'number' && (this.data[gIndex].divider || !this.data[gIndex].list)) {
      return;
    }
    const moveCount = (this.draggingInfo.startPageY - touchInfo.pageY) / 32;
    const movedIndex = this.currentIndexList[gIndex] + moveCount;
    this.currentIndexList[gIndex] = movedIndex;
    this.draggingInfo.startPageY = touchInfo.pageY;
  }
````

With default change detection, Angular detects every `MouseMove-Event`  and causes a change detection cycle to be executed, updating the component and its graphical representation. With OnPush, we prevent this default behavior. We would have to manually mark the component with `markForCheck` or have it checked directly with `detectChanges` to get it working correctly because the update is dependent on events and not triggered by changing input parameters.

````
handleMove(ev): void {
    ev.preventDefault();
    ev.stopPropagation();
    if (this.touchOrMouse.isTouchable || this.touchOrMouse.isMouseDown) {
      this.draggingInfo.isDragging = true;
      this.setCurrentIndexOnMove(ev);

      //Manualy trigger Change Detection
      this.cdRef.detectChanges()
    }
  }
````

But was the problem here really purely the overuse of OnPush? Not quite. For example, if we set all components, except for the `Data-Picker-Component` to the default mechanism, we see that the problem still exists. So, the inappropriate use of OnPush on this component was the problem. 

If we turn the tables and activate OnPush for all other components, except for the 'data picker component,' we also see that the problem still exists. But if we imagine a much larger and more complex application, with a much larger component tree, the overuse of OnPush makes the localization of the actual problem much more difficult. 

This example shows that the blind usage of OnPush makes little sense, and it is crucial to understand the underlying concepts correctly. Otherwise, it leads to unexpected problems in most cases. Therefore it is advised to use OnPush only with caution. For example, only when performance problems occur within the application (stutters or frame drops, etc.) or directly on components that are only intended for presentational purposes (also called "presentational components") and are purely controlled via their "@Input parameters." This way, unnecessary change detection cycles can be avoided from the beginning.

## Mutable Objects and OnPush don't like eachother
---
What we learned so far leads us to another common problem regarding OnPush. As mentioned earlier, OnPush and `Presentaional-Components` can complement each other perfectly. However, even here, certain pitfalls can lurk if you don't rely on `Immutable` Objects / Inputs from the beginning. 

Let's have a look at the following example. A presentational component with OnPush Change Detection recieves an object as input parameter. The object is displayed correctly; so far, so good. Then the value of the object is changed within the parent component. But what do we see? The change is not correctly displayed in the child component. But when we log the object we see that everything should be fine.

//CODE

This has the simple reason that OnPush-based components compare their input parameters via object comparison (`Object.is()`). In the previous case, the object itself did not change; instead, only an object variable was mutated. The `@Input` registers no change and doesn't mark the component for change detection. Exactly such problem constellations can often lead to unintentionally sprawling debugging sessions. To avoid these from the outset, an Immutable state or immutable objects should be used. This means that changes to objects are not carried out directly on these, but a change result is ALWAYS a new object with the adapted state. This way, you make shure that the object comparison always triggers a change detection cycle and does not lead to this unpleasant constellation.

## Conclusion
---
Finally, let's briefly summarize our findings again. First, when using OnPush, we should be careful not to apply it all over the place blindly but rather look carefully at what kind of components (e.g., is the component state controlled purely by `@input parameters`) could benefit from OnPush to prevent unnecessary change detection cycles.
Second, we should take care that when we use OnPush and objects are passed as input parameters, we rely on immutability. We do not directly change values on objects but always replace them with a "new" object with adjusted values.
And last but not least, of course, the best possible performance of our Angular applications is essential for the best possible user experience. But don't forget to follow the most important rule of performance optimization. **Don't**. Don't worry about performance optimization if you are dealing with smaller applications or not encountering issues like stuttering or frame drops. And if you're interested in the best possible performance from the start, keep in mind what we've just learned.


[cd-cycle]: https://www.thinktecture.com/storage/2021/08/cd_default-2048x798.png  "Angular CD-Cycle"