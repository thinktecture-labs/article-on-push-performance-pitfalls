# Angular OnPush - A change detection strategy revealing mistakes in your code

### Abstract
>When optimizing the performance of Angular applications, many developers directly associate Angular's OnPush change detection strategy with it. But, if you don't know exactly how OnPush works under the hood, it will quickly teach you what you are doing wrong the hard way. In this article, we'll look deeper into how the OnPush strategy affects Angular's change detection mechanism and which pitfalls we should avoid at all costs.

## Intro
---
At Thinktecture, we support our customers with various problems in our daily work. Of course, the topic of performance optimization is always on the agenda. Many developers from the Angular environment associate “performance optimization” directly with **OnPush**. Accordingly, OnPush is often used in many projects right from the start. But using OnPush doesn’t automatically guarantee skyrocketing your application’s performance. If you lack knowledge of what it does under the hood, it can quickly turn into the opposite. It can lead to unexpected problems, which may only become apparent much later in the project and are not easy to detect. To help you avoid these pitfalls right from the start, we’ll first dive into Angular’s code to look at what OnPush does with the change detection mechanism and then head into some examples.

>Before we dig into the internals of OnPush, you should make sure that you have a general understanding of what change detection is, why we need it and how Angular handles it. If you need a quick refresh or a basic introduction to the topic, I highly suggest looking at the article [What’s the hype with OnPush](https://www.thinktecture.com/angular/whats-the-hype-onpush/), by my colleague Max Marshall first.

## Component = View
---
As we all know, our components in Angular form a hierarchical tree structure. However, the change detection is not executed on the components but on a low-level abstraction layer called `View` or, more precise, [ViewData](https://github.com/angular/angular/blob/6b79ab5abec8b5a4b43d563ce65f032990b3e3bc/packages/core/src/view/types.ts#L301). (The term `View` will be used interchangeably with the word `Component` in the following)  A `View` is directly associated with an instance of a component and contains additional state information, the [ViewState](https://github.com/angular/angular/blob/6b79ab5abec8b5a4b43d563ce65f032990b3e3bc/packages/core/src/view/types.ts#L325)). This state is very important to decide whether a change detection cycle for the `View` and all its children will be skipped or not. The most important property here is `ChecksEnabled.` It defaults to `true,` but when it is set to `false,` the checkings of the view and all its children will be skipped. And this is where `ChangeDetectionStrategies` come into play. 

## Angular's two change detection strategies
---
The default of `ChecksEnabled = true` corresponds to Angular's `ChangeDetecthionStrategy.Default`. Here Angular starts at the top view and recursively applies the check and update process for all child views the tree downwards.

![cd-cycle]

So `ChangedetectionStrategy.OnPush` must therefore set `ChecksEnabled = false` right? It is not quite that simple. As mentioned before, all views default to `true`. After the first initial view check, all components with OnPush will be set to `false`. (Angular code [here](https://github.dev/angular/angular/blob/6b79ab5abec8b5a4b43d563ce65f032990b3e3bc/packages/core/src/view/view.ts#L345))

 ````
if (view.def.flags & ViewFlags.OnPush) {
    view.state &= ~ViewState.ChecksEnabled;
  }
````
However, if the `@Input` of the component changes checks should be sheduled again.  This is achieved during the `updateProp` function where the `ChecksEnabled` flag is set to true for one change detection cycle. (Angular Code [here](https://github.com/angular/angular/blob/6b79ab5abec8b5a4b43d563ce65f032990b3e3bc/packages/core/src/view/provider.ts#L441))

````
if (compView.def.flags & ViewFlags.OnPush) {
      compView.state |= ViewState.ChecksEnabled;
  }
````
At this point, it should be mentioned that a component with OnPush is not only checked when its inputs change but there are four possible scenarios.

- When `@Input` changes
- When a `Event` triggers within a component with OnPush (or its children downwards the tree)
- When async data changes that is bound with the `async`-Pipe
- Manually by calling `markForCheck` or `detectChanges`

So what can we take away from this? We saw that OnPush is not a performance tool per se; it is just a different strategy for Angular's change detection that can help to reduce unnecessary change detection cycles, which may result in better performance. Especially within larger applications with many components, but it isn't a guaranteed performance booster for every application.

After all this dry theory, it is time for some practical examples.


## Always do it the 'Angular way'
---
During my daily work, I stumbled over a [git repository](https://github.com/hiyali/ng-data-picker), which implements a graphical data picker component. It is an excellent example of how OnPush can show you your mistakes. I created an Angular application with the mentioned data picker in the following example. (I took the code from the repository and adapted it a bit to fit the current Angular version; please feel free to play around with it). 

When the `ChangeDetectionStrategy` is set to Default, everything works smoothly. But when we put it to OnPush, the component seems broken. Typically, the data wheel should rotate and lock when released. But what is the reason for this?

// [Stackblitz](https://stackblitz.com/edit/github-jga3rl?file=src/app/child/child.component.html)


When we look at the components code, we are even more confused. There are several event handlers reacting to mouse events. When we interact with the wheel and look at the console, we see that the events are registered and doing their work.

As a result of what we have learned, a change detection cycle should have been triggered. But why it was not? 
The error is basically where the `EventHandler` registration takes place. When we look at the code, we can see that the handlers directly get registered on the element with `addEventListener`. This standard JavaScript approach results in the events being registered globally. As a result, Angular doesn't know that the events are assigned to this particular component. So due to `ChecksEnabled` being `false` on our OnPush component, it still will be ignored from change detection. 

````
  addEventsForElement(el): void {
    const _ = this.touchOrMouse.isTouchable;
    const eventHandlerList = [
      { name: _ ? 'touchstart' : 'mousedown', handler: this.handleStart },
      { name: _ ? 'touchmove' : 'mousemove', handler: this.handleMove },
      { name: _ ? 'touchend' : 'mouseup', handler: this.handleEnd },
      {
        name: _ ? 'touchcancel' : 'mouseleave',
        handler: this.handleCancel,
      },
    ];

    eventHandlerList.forEach((item, index) => {
      el.removeEventListener(item.name, item.handler, false);
      el.addEventListener(item.name, item.handler.bind(this), false);
    });
  }

````

But how can we solve the problem? In this case, it is pretty simple. We need to register the events in the "Angular way". This
means, for example, via template binding. Thus, the framework can map the event to the component and mark it to be checked, although OnPush is set.
This small example shows us how important it is to solve our problems with the tools that Angular provides and how OnPush has shown us our mistakes that we possibly wouldn't have discovered with the default strategy.
## Mutable Objects and OnPush don't like eachother
---

Let's have a look at another example. A presentational component with OnPush change detection receives a person object as an input parameter. After the startup, the object is displayed correctly; so far, so good. Then we change a value in the form. But what do we see? Nothing happens. The change is not correctly displayed in the child component. But when we check the output in the console, everything should work correctly.

// [Stackblitz](https://stackblitz.com/edit/angular-ivy-nek9kf?file=src/app/app.component.ts)

This has the simple reason that OnPush-based components compare their input parameters via object comparison (`Object.is()`). In the previous case, the object itself did not change; instead, only an object variable was mutated. 

````
mutatePerson() {
    this.person.name = this.form.value.name;
    this.person.lastName = this.form.value.lastName;
    this.person.age = this.form.value.age;
    console.log('Person mutaded values: ', this.person);
  }

````

The `@Input` registers no change and doesn't set the `ChecksEnabled` flag for the next cycle. Exactly such problem constellations can often lead to unintentionally sprawling debugging sessions. To avoid these from the outset, an immutable state or immutable objects should be used. This means that changes to objects are not carried out directly on these, but a change result is **always** a new object with the adapted state. This is also recommended to treat your objects using any store pattern or store-related library like [ngrx](https://ngrx.io/).

 >If you are also interested in this topic, check out the articles and webinars of my colleague [Yannick Baron](https://www.thinktecture.com/thinktects/yannick-baron/).

Last but not least how do we fix our example? As meantioned before, we need to replace the person object with a new one. And everything works as expected.

````
  mutatePerson() {
    this.person = this.form.value;
    console.log('Person mutaded values: ', this.person);
  }
````

## Conclusion
---
Finally, let's briefly summarize our learnings. We saw that OnPush is not a performance tool per se. It just changes the strategy of Angular handling the change detection cycles. When using OnPush, we need to take the responsibility of knowing when the view actually gets updated and possibly need to update it manually. As a result, it rewards us with reduced change detection cycles and, therefore, may increase the performance of our applications. But be aware that OnPush also mercilessly shows us our mistakes which may result in some headaches. But after you read this article, these headaches should be history by now. To avoid them even better, follow the most important rule of performance optimization. **Don't**. Don't worry about optimization if you are dealing with smaller applications or not encountering issues like stuttering or frame drops. And if you're interested in the best possible performance from the start, keep in mind what we've just learned.


[cd-cycle]: https://www.thinktecture.com/storage/2021/08/cd_default-2048x798.png  "Angular CD-Cycle"