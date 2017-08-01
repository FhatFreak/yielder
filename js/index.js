const svgns = 'http://www.w3.org/2000/svg';
const mainSVG = document.getElementById('main');

function toSvgPoint(svg, x, y) {
    const p = svg.createSVGPoint();
    p.x = x;
    p.y = y;
    return p.matrixTransform(svg.getScreenCTM().inverse());
}

const mouseDowns = Kefir.fromEvents(mainSVG, 'mousedown');
const mouseMoves = Kefir.fromEvents(document, 'mousemove');
const mouseUps = Kefir.fromEvents(document, 'mouseup');
const touchStarts = Kefir.fromEvents(mainSVG, 'touchstart');
const touchMoves = Kefir.fromEvents(document, 'touchmove');
const touchEnds = Kefir.fromEvents(document, 'touchend');
const touchCancels = Kefir.fromEvents(document, 'touchcancel');

const mouseDrags = mouseDowns.map(downEvent => mouseMoves
    .toProperty(_ => downEvent)
    .takeUntilBy(mouseUps)
    .map(event => toSvgPoint(mainSVG, event.clientX, event.clientY)));

const multiTouchStarts = touchStarts.filter(event => event.touches.length > 1);
const touchDragStops = Kefir.merge([touchEnds, touchCancels, multiTouchStarts])

const touchDrags = touchStarts
    .filter(event => event.touches.length === 1)
    .onValue(event => event.preventDefault())
    .map(startEvent => touchMoves
        .toProperty(_ => startEvent)
        .takeUntilBy(touchDragStops)
        .map(event => toSvgPoint(mainSVG, event.touches[0].clientX, event.touches[0].clientY)));

const drags = Kefir.merge([touchDrags, mouseDrags])
    .map(drag => drag.skipDuplicates((a, b) => {
        const {x:x1, y:y1} = a;
        const {x:x2, y:y2} = b;
        return x1 === x2 && y1 === y2;
    }));

drags.onValue(drag => drag
    .slidingWindow(2, 2)
    .onValue(points => {
        const [{x:x1, y:y1}, {x:x2, y:y2}] = points;
        const line = document.createElementNS(svgns, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', 'black');
        mainSVG.appendChild(line);
    }));