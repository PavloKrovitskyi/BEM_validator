// Combined BEM validator
(function () {
  const doc = document;

  // --- Selectors ---
  const SELECTORS = {
    validateInput: '[data-validate-input]',
    validateSubmit: '[data-validate-submit]',
    errorsPanel: '.validator__errors',
    treeViewContent: '.view-tree__content',
    treeDeepRange: '.deep-tree__range',
    treeDeepDigit: '.deep-tree__digit',
    treeClassItem: '.tree-class__item',
    validatorInner: '.validator__inner',
    validatorHeader: '.validator__header',
  };

  // --- CSS class names used dynamically ---
  const CLASSNAMES = {
    treeLevel: 'tree-level',
    treeLevel0: 'tree-level--0',
    treeLevelItem: 'tree-level__item',
    treeLevelElem: 'tree-level__elem',
    treeElem: 'tree-elem',
    treeElemTag: 'tree-elem__tag',
    treeElemClass: 'tree-elem__class',
    treeClass: 'tree-class',
    treeClassItem: 'tree-class__item',
    treeClassDot: 'tree-class__dot',
    treeHighlightBem: 'tree-highlight--bem',
    validatorInnerHidden: 'validator__inner--hidden',
    validatorInnerWarning: 'validator__inner--warning',
    validatorInnerErrors: 'validator__inner--errors',
    validatorInnerNoErrors: 'validator__inner--no-errors',
  };

  const {
    validateInput,
    validateSubmit,
    treeViewContent,
    treeDeepRange,
    treeDeepDigit,
    errorsPanel: errorsPanelSelector,
    treeClassItem: treeClassItemSelector,
    validatorInner: validatorInnerSelector,
    validatorHeader: validatorHeaderSelector,
  } = SELECTORS;

  const textarea = doc.querySelector(validateInput);
  const errorsPanel = doc.querySelector(errorsPanelSelector);
  const treeContent = doc.querySelector(treeViewContent);
  const rangeDeep = doc.querySelector(treeDeepRange);
  const valDeep = doc.querySelector(treeDeepDigit);
  const validatorInner = doc.querySelector(validatorInnerSelector);
  const validatorHeader = doc.querySelector(validatorHeaderSelector);

  // --- State ---
  let maxDeep = 1;

  let bodyClass = null;
  let htmlClass = null;

  // --- Constants ---
  const ERROR_CODES = {
    noParentBlock: 'NO_PARENT_BLOCK',
    recursiveElement: 'RECURSIVE_ELEMENT',
    onlyModifier: 'ONLY_MODIFIER',
    recursiveBlock: 'RECURSIVE_BLOCK',
    elementOfElement: 'ELEMENT_OF_ELEMENT',
    moreThanOneBlock: 'MORE_THAN_ONE_BLOCK',
    moreThanOneElement: 'MORE_THAN_ONE_ELEMENT',
    hierarchy: 'HIERARCHY',
    onlyClosestParent: 'ONLY_CLOSEST_PARENT',
  };

  const ERROR_TRANSLATION = {
    [ERROR_CODES.elementOfElement]: 'Подвійний елемент',
    [ERROR_CODES.recursiveBlock]: 'Блок знаходиться в блоці з тим же іменем',
    [ERROR_CODES.recursiveElement]: 'Елемент знаходиться в елементі з тим же іменем',
    [ERROR_CODES.noParentBlock]: 'БЕМ-елемент не може знаходитись за межами свого БЕМ-блоку',
    [ERROR_CODES.onlyModifier]: 'Модифікатор використовується без блока або елемента',
    [ERROR_CODES.moreThanOneBlock]: "Об'єкт не може бути одночасно двома BEM-блоками",
    [ERROR_CODES.moreThanOneElement]: "Об'єкт не може бути одночасно двома BEM-елементами",
    [ERROR_CODES.hierarchy]: 'При формуванні імені класу не має бути спроби ієрархії',
    [ERROR_CODES.onlyClosestParent]: 'Назва елементу починається не з поточного батьківського БЕМ-блоку',
  };

  const headersOrder = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
  const skippedTags = ['SCRIPT', 'META', 'TITLE', 'LINK', 'NOSCRIPT', 'BR'];
  const highlightColorNum = 0;

  const elementData = new WeakMap();

  const styleElem = doc.createElement('style');
  doc.head.appendChild(styleElem);

  let isValidating = false;

  function escapeHTML(str) {
    const div = doc.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===================================================================
  //   BEM validation helpers
  // ===================================================================

  function getParentPathWithHighlight(parentArray, errorClass) {
    const filteredArray = parentArray.filter((array) => array.length > 0);
    const mappedArray = filteredArray.map((array) => array.join('.'));
    const joinedArray = '.' + mappedArray.join(' > .');

    const blockName = errorClass.split('__')[0];
    const searchStr = '.' + blockName;

    // Find last exact class match (avoid matching inside longer names like .message-tree inside .message-trees)
    let lastIndex = -1;
    let pos = joinedArray.length;
    while ((pos = joinedArray.lastIndexOf(searchStr, pos - 1)) !== -1) {
      const after = pos + searchStr.length;
      const nextChar = joinedArray[after] || '';
      // Valid: end of string, class separator, space (next segment), __ (BEM element), or -- (BEM modifier)
      if (nextChar === '' || nextChar === '.' || nextChar === ' ' || nextChar === '_' || (nextChar === '-' && joinedArray[after + 1] === '-')) {
        lastIndex = pos;
        break;
      }
    }

    if (lastIndex === -1) return escapeHTML(joinedArray);

    const highlightedPath =
      escapeHTML(joinedArray.slice(0, lastIndex)) +
      '<span class="correct">' +
      escapeHTML(joinedArray.slice(lastIndex, joinedArray.indexOf('>', lastIndex) + 1)) +
      '</span>' +
      escapeHTML(joinedArray.slice(joinedArray.indexOf('>', lastIndex) + 1));

    return highlightedPath;
  }

  function parseClassName(className) {
    const regExp =
      /([a-z0-9]+(?:-[a-z0-9]+)*)(?:__([a-z0-9]+(?:-[a-z0-9]+)*))?(?:--([a-z0-9]+(?:-[a-z0-9]+)*))?(?:--([a-z0-9]+(?:-[a-z0-9]+)*))?/i;

    const match = regExp.exec(className) || [];
    return {
      blockName: match[1],
      elementName: match[2],
      modifierName: match[3],
      modifierValue: match[4],
    };
  }

  function getBemType(className) {
    const parsed = parseClassName(className);
    if (!parsed.blockName) return 'UNKNOWN';
    if (parsed.modifierName) return 'MODIFIER';
    if (parsed.elementName) return 'ELEMENT';
    // Structurally ambiguous: has block-like prefix but no BEM delimiters
    if (className.includes('__') || className.includes('--')) return 'BLOCK';
    return 'UNCLASSIFIED';
  }

  function testElementForClosestParent(blockName, parentArray = []) {
    for (let i = parentArray.length - 1; i >= 0; i -= 1) {
      if (parentArray[i].some((pc) => pc === blockName)) break;
      if (parentArray[i].some((pc) => getBemType(pc) === 'BLOCK')) return true;
    }
    return false;
  }

  function validateNode(node, parentArray = []) {
    const errors = [];
    const children = Array.from(node.children);
    const currentClasses = Array.from(node.classList);

    const classTypes = new Map(currentClasses.map((cc) => [cc, getBemType(cc)]));
    const blockClassesInCurrent = currentClasses.filter((cc) => classTypes.get(cc) === 'BLOCK');
    const hasMoreThanOneBlock = blockClassesInCurrent.length > 1;
    const elementClassesInCurrent = currentClasses.filter((cc) => classTypes.get(cc) === 'ELEMENT');
    const hasMoreThanOneElement = elementClassesInCurrent.length > 1;

    currentClasses.forEach((className) => {
      const parsed = parseClassName(className);
      const { blockName, elementName, modifierName } = parsed;
      const type = classTypes.get(className);
      if (type === 'UNKNOWN' || type === 'UNCLASSIFIED') return;
      const flatParents = parentArray.reduce((a, b) => a.concat(b), []);

      if (elementName && !flatParents.some((pc) => pc === blockName)) {
        errors.push({ code: ERROR_CODES.noParentBlock, className, parentArray });
      }

      if (elementName && flatParents.some((pc) => pc === blockName + '__' + elementName)) {
        errors.push({ code: ERROR_CODES.recursiveElement, className, parentArray });
      }

      if (
        modifierName &&
        !currentClasses.some((cc) => {
          return elementName ? cc === blockName + '__' + elementName : blockName === cc;
        })
      ) {
        errors.push({ code: ERROR_CODES.onlyModifier, className, parentArray });
      }

      if (type === 'BLOCK' && flatParents.some((pc) => pc === blockName)) {
        errors.push({ code: ERROR_CODES.recursiveBlock, className, parentArray });
      }

      if (className.split('__').length > 2) {
        errors.push({ code: ERROR_CODES.elementOfElement, className, parentArray });
      }

      if (type === 'BLOCK' && hasMoreThanOneBlock) {
        errors.push({ code: ERROR_CODES.moreThanOneBlock, className, parentArray });
      }

      if (type === 'ELEMENT' && hasMoreThanOneElement) {
        errors.push({ code: ERROR_CODES.moreThanOneElement, className, parentArray });
      }

      if (type === 'BLOCK' && flatParents.some((pc) => blockName.startsWith(pc + '-'))) {
        errors.push({ code: ERROR_CODES.hierarchy, className, parentArray });
      }

      if (
        type === 'ELEMENT' &&
        flatParents.some((pc) => {
          if (getBemType(pc) !== 'ELEMENT') return false;
          return className.startsWith(pc + '-');
        })
      ) {
        errors.push({ code: ERROR_CODES.hierarchy, className, parentArray });
      }

      if (type === 'ELEMENT' && testElementForClosestParent(blockName, parentArray)) {
        errors.push({ code: ERROR_CODES.onlyClosestParent, className, parentArray });
      }
    });

    children.forEach((child) => {
      const childErrors = validateNode(child, parentArray.concat([currentClasses]));
      childErrors.forEach((e) => errors.push(e));
    });

    return errors;
  }

  function insertErrors(errors, emptyInput = false, customMessage) {
    errorsPanel.innerHTML = '';

    if (emptyInput) {
      validatorHeader.innerHTML = `<h2 class="validator__title">${customMessage || 'Вставте код в поле для валідації'}</h2>`;
      return;
    }

    if (errors.length === 0) {
      validatorHeader.innerHTML = '<h2 class="validator__title">Відмінно, помилки відсутні 😎</h2>';
      return;
    }

    validatorHeader.innerHTML = '<h2 class="validator__title">Упс знайдено помилки 🧐</h2>';

    // Group errors by className
    const grouped = new Map();
    errors.forEach((error) => {
      if (!grouped.has(error.className)) {
        grouped.set(error.className, { codes: [], parentArray: error.parentArray });
      }
      const entry = grouped.get(error.className);
      if (!entry.codes.includes(error.code)) {
        entry.codes.push(error.code);
      }
    });

    const output = Array.from(grouped.entries())
      .map(
        ([className, { codes, parentArray }]) =>
          `<li class="errors__item">
        <h3 class="errors__label">${codes.map((code) => `<span data-code="${code}">${ERROR_TRANSLATION[code]}</span>`).join('')}</h3>
        <p class="errors__desc"><code>${getParentPathWithHighlight(parentArray, className)} > <span>.${escapeHTML(className)}</span></code></p></li>`,
      )
      .join('');

    errorsPanel.innerHTML = `<ul class="errors__list">${output}</ul>`;
  }

  // ===================================================================
  //   Tree building helpers
  // ===================================================================

  function createTreeFromHTML(code, errors) {
    const errorsByClassName = new Map();
    errors.forEach((e) => {
      if (!errorsByClassName.has(e.className)) {
        errorsByClassName.set(e.className, []);
      }
      errorsByClassName.get(e.className).push(e);
    });

    const codeOutput = doc.createElement('div');
    let codeOutputTarget = codeOutput;

    if (!code) {
      setRange();
      return;
    }

    // Fix for minified code
    code = code.replace(/>\s*</g, '>\n<');

    bodyClass = getTagClass(code);
    htmlClass = getTagClass(code, 'html');

    if (htmlClass) {
      codeOutputTarget = doc.createElement('div');
      codeOutput.append(codeOutputTarget);
      htmlClass.forEach((item) => {
        if (item) codeOutput.classList.add(item);
      });
    }
    if (bodyClass) {
      bodyClass.forEach((item) => {
        if (item) codeOutputTarget.classList.add(item);
      });
    }

    // SAFE: parse via DOMParser instead of innerHTML (scripts are not executed)
    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(code, 'text/html');
    const parsedBody = parsedDoc.body;
    while (parsedBody.firstChild) {
      codeOutputTarget.appendChild(parsedBody.firstChild);
    }

    const items = makeList(codeOutput, 1, errorsByClassName);

    if (treeContent.childElementCount > 0) {
      treeContent.removeChild(treeContent.firstElementChild);
    }

    const list = doc.createElement('ul');
    list.classList.add(CLASSNAMES.treeLevel, CLASSNAMES.treeLevel0);
    list.appendChild(items);
    treeContent.appendChild(list);

    setRange();
  }

  function makeList(elem, level, errorsByClassName, parentClassLists) {
    if (parentClassLists === undefined) parentClassLists = [];
    if (elem.nodeType !== Node.ELEMENT_NODE) return null;
    const item = doc.createElement('li');
    item.classList.add(CLASSNAMES.treeLevelItem);
    let tagName = elem.tagName;
    const classListValue = elem.classList.value;

    if (!elementData.has(elem)) {
      elementData.set(elem, { prefixes: {}, level });
    }

    if (htmlClass) {
      if (level === 1) tagName = 'HTML';
      else if (level === 2) tagName = 'BODY';
    } else if (level === 1) {
      tagName = 'BODY';
    }

    const liContent = doc.createElement('div');
    liContent.classList.add(CLASSNAMES.treeLevelElem, CLASSNAMES.treeElem);

    const tagSpan = doc.createElement('span');
    tagSpan.classList.add(CLASSNAMES.treeElemTag);
    tagSpan.textContent = tagName;

    liContent.appendChild(tagSpan);
    addClassesAsPrefixes(elem);

    if (classListValue) {
      const classSpan = doc.createElement('span');
      classSpan.classList.add(CLASSNAMES.treeElemClass, CLASSNAMES.treeClass);

      Array.from(elem.classList).forEach((classItem, i) => {
        const classItemBtn = doc.createElement('button');
        classItemBtn.classList.add(CLASSNAMES.treeClassItem);
        classItemBtn.textContent = classItem;

        if (errorsByClassName.has(classItem)) {
          const classErrors = errorsByClassName.get(classItem);
          const matches = classErrors.some(function (error) {
            return parentArraysMatch(error.parentArray, parentClassLists);
          });
          if (matches) {
            classItemBtn.classList.add(CLASSNAMES.treeHighlightBem);
          }
        }

        classSpan.appendChild(classItemBtn);
        if (i < elem.classList.length - 1) classSpan.appendChild(doc.createTextNode(' '));
      });

      const classDotSpan = doc.createElement('span');
      classDotSpan.classList.add(CLASSNAMES.treeClassDot);
      classDotSpan.textContent = '.';
      liContent.appendChild(classDotSpan);
      liContent.appendChild(classSpan);
    }

    item.appendChild(liContent);

    if (elem.children) {
      const childrenList = doc.createElement('ul');
      level++;
      childrenList.classList.add(CLASSNAMES.treeLevel, `tree-level--${level}`);

      Array.from(elem.children).forEach(function (child) {
        if (!checkIsSkippedTag(child)) {
          var childParentLists = parentClassLists.concat([Array.from(elem.classList)]);
          var newElem = makeList(child, level, errorsByClassName, childParentLists);
          if (newElem) childrenList.appendChild(newElem);
        }
      });

      if (childrenList.children.length > 0) {
        if (level > maxDeep) maxDeep = level;
        item.appendChild(childrenList);
      }
    }

    return item;
  }

  function addClassesActions() {
    const colors = ['aqua', 'lime', 'yellow', 'fuchsia'];
    const classItemSpanList = treeContent.querySelectorAll(treeClassItemSelector);

    classItemSpanList.forEach((classItemSpan) => {
      classItemSpan.addEventListener('click', function () {
        classItemSpanList.forEach((span) => {
          span.dataset.color = '';
        });
        this.dataset.color = colors[highlightColorNum];

        if (this.classList.contains(CLASSNAMES.treeHighlightBem)) {
          const className = '.' + this.textContent;
          const errorItems = errorsPanel.querySelectorAll('.errors__item');
          for (const item of errorItems) {
            const classSpan = item.querySelector('.errors__desc code span:last-child');
            if (classSpan && classSpan.textContent === className) {
              item.scrollIntoView({ behavior: 'smooth', block: 'center' });
              item.classList.remove('errors__item--flash');
              // Force reflow to restart animation
              void item.offsetWidth;
              item.classList.add('errors__item--flash');
              break;
            }
          }
        }
      });
    });
  }

  function addClassesAsPrefixes(elem) {
    copyPrefixes(elem);

    Array.from(elem.classList).forEach((classItem) => {
      const hasDashes = classItem.indexOf('--') >= 0;
      const hasUnderlines = classItem.indexOf('__') >= 0;
      const matchSingle = classItem.match(/[^_]_[^_]/);

      if (!hasUnderlines && !hasDashes && !matchSingle) {
        const data = elementData.get(elem);
        if (data) data.prefixes[classItem] = classItem;
      }
    });
  }

  function copyPrefixes(elem) {
    const parent = elem.parentNode;
    if (!parent || !elementData.has(parent)) return;
    const parentData = elementData.get(parent);
    const elemData = elementData.get(elem);
    if (!parentData || !elemData) return;
    for (const prefix in parentData.prefixes) {
      if (Object.prototype.hasOwnProperty.call(parentData.prefixes, prefix)) {
        elemData.prefixes[prefix] = prefix;
      }
    }
  }

  function setRange() {
    rangeDeep.max = maxDeep;
    rangeDeep.value = maxDeep;
    valDeep.textContent = maxDeep;
  }

  function checkIsSkippedTag(elem) {
    return skippedTags.includes(elem.tagName);
  }

  function parentArraysMatch(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const innerA = a[i];
      const innerB = b[i];
      if (innerA.length !== innerB.length) return false;
      for (let j = 0; j < innerA.length; j += 1) {
        if (innerA[j] !== innerB[j]) return false;
      }
    }
    return true;
  }

  function getTagClass(code, tagName = 'body') {
    const regexp = new RegExp('<' + tagName + '[^>]*class=["\']([^"\']*)["\']');
    const result = code.match(regexp);
    if (result) return result[1].split(' ');
    return null;
  }

  // ===================================================================
  //   Depth slider
  // ===================================================================

  rangeDeep.addEventListener('input', function () {
    const level = +this.value;
    styleElem.innerHTML = `.tree-level--${level} { display: none }`;
    valDeep.textContent = this.value;
  });

  // ===================================================================
  //   Main validate — triggered by button click
  // ===================================================================

  function validate() {
    if (isValidating) return;
    isValidating = true;

    const input = textarea.value.trim();

    maxDeep = 1;

    if (input === '') {
      insertErrors([], true);
      setInnerModifier(CLASSNAMES.validatorInnerWarning);
      isValidating = false;
      return;
    }

    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(input, 'text/html');
    const body = parsedDoc.body;

    const errors = validateNode(body);
    insertErrors(errors);

    if (errors.length > 0) {
      setInnerModifier(CLASSNAMES.validatorInnerErrors);
      createTreeFromHTML(input, errors);
      addClassesActions();
    } else {
      setInnerModifier(CLASSNAMES.validatorInnerNoErrors);
    }

    isValidating = false;
  }

  function setInnerModifier(modifier) {
    validatorInner.classList.remove(
      CLASSNAMES.validatorInnerHidden,
      CLASSNAMES.validatorInnerWarning,
      CLASSNAMES.validatorInnerErrors,
      CLASSNAMES.validatorInnerNoErrors
    );
    validatorInner.classList.add(modifier);
  }

  // ===================================================================
  //   Initialize
  // ===================================================================

  const validateButton = doc.querySelector(validateSubmit);
  validateButton.addEventListener('click', validate);
})();
