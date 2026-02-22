/**
 * CSS 选择器生成器
 * 生成稳定、可靠的选择器用于元素定位
 */

/**
 * 动态特征正则表达式
 * 用于过滤不稳定的 class/id
 */
const DYNAMIC_PATTERNS = [
  /jqx[\w-]*/i,           // jqx 前缀
  /random[\w-]*/i,        // random 前缀
  /css-[a-z0-9]+/i,       // css- 前缀
  /\d{5,}/,               // 5位以上数字
  /__[a-z0-9]{5,}/i,      // BEM 随机哈希
  /scoped_[\w]+/i,         // scoped 样式
  /data-v-[a-z0-9]+/i,    // Vue scoped
  /_[a-z0-9]{6,}/i,       // 下划线+随机字符
];

/**
 * 语义属性列表
 * 优先级从高到低
 */
const SEMANTIC_ATTRIBUTES = [
  'data-article-id',
  'data-post-id',
  'data-content-id',
  'data-block-id',
  'data-section-id',
  'id',
];

/**
 * 语义 class 关键词
 */
const SEMANTIC_CLASS_KEYWORDS = [
  'content',
  'article',
  'post',
  'section',
  'block',
  'paragraph',
  'text',
  'body',
  'main',
];

/**
 * 检查是否为动态特征
 * @param value 要检查的字符串
 * @returns 是否为动态特征
 */
function isDynamicFeature(value: string): boolean {
  return DYNAMIC_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * 检查是否为语义 class
 * @param className class 名
 * @returns 是否为语义 class
 */
function isSemanticClass(className: string): boolean {
  return SEMANTIC_CLASS_KEYWORDS.some(keyword => 
    className.toLowerCase().includes(keyword)
  );
}

/**
 * 获取元素的稳定属性选择器
 * @param element 目标元素
 * @returns 属性选择器或 null
 */
function getStableAttributeSelector(element: Element): string | null {
  // 优先检查语义属性
  for (const attr of SEMANTIC_ATTRIBUTES) {
    const value = element.getAttribute(attr);
    if (value && !isDynamicFeature(value)) {
      return `[${attr}="${value}"]`;
    }
  }
  
  // 检查 data-* 属性
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-') && !isDynamicFeature(attr.value)) {
      // 确保属性值不会太长
      if (attr.value.length < 50) {
        return `[${attr.name}="${attr.value}"]`;
      }
    }
  }
  
  return null;
}

/**
 * 获取元素的稳定 class 选择器
 * @param element 目标元素
 * @returns class 选择器或 null
 */
function getStableClassSelector(element: Element): string | null {
  if (!element.classList.length) return null;
  
  const stableClasses: string[] = [];
  
  for (const className of element.classList) {
    // 过滤动态特征
    if (isDynamicFeature(className)) continue;
    
    // 优先选择语义 class
    if (isSemanticClass(className)) {
      return `.${className}`;
    }
    
    stableClasses.push(className);
  }
  
  // 如果没有语义 class，返回第一个稳定 class
  if (stableClasses.length > 0) {
    return `.${stableClasses[0]}`;
  }
  
  return null;
}

/**
 * 向上查找语义容器
 * @param element 起始元素
 * @param maxLevels 最大向上层级
 * @returns 语义容器元素
 */
function findSemanticContainer(element: Element, maxLevels: number = 5): Element {
  let current: Element | null = element;
  let levels = 0;
  
  while (current && levels < maxLevels) {
    // 检查是否有语义属性
    if (getStableAttributeSelector(current)) {
      return current;
    }
    
    // 检查是否有语义 class
    const classSelector = getStableClassSelector(current);
    if (classSelector && isSemanticClass(classSelector.slice(1))) {
      return current;
    }
    
    // 检查是否是语义标签
    const semanticTags = ['article', 'section', 'main', 'aside', 'header', 'footer'];
    if (semanticTags.includes(current.tagName.toLowerCase())) {
      return current;
    }
    
    current = current.parentElement;
    levels++;
  }
  
  // 如果没找到，返回原始元素或 body
  return element;
}

/**
 * 生成从根到目标元素的完整路径选择器
 * @param element 目标元素
 * @returns 完整选择器路径
 */
function generateFullPath(element: Element): string {
  const path: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    // 尝试添加 id
    if (current.id && !isDynamicFeature(current.id)) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break; // 有 id 就可以停止了
    }
    
    // 尝试添加稳定的 class
    const classSelector = getStableClassSelector(current);
    if (classSelector) {
      selector += classSelector;
    }
    
    // 添加 nth-child 以确保唯一性
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

/**
 * 生成从容器到目标元素的相对路径
 * @param container 容器元素
 * @param target 目标元素
 * @returns 相对选择器路径
 */
function generateRelativePath(container: Element, target: Element): string {
  const path: string[] = [];
  let current: Element | null = target;
  
  while (current && current !== container) {
    let selector = current.tagName.toLowerCase();
    
    // 尝试添加稳定的 class
    const classSelector = getStableClassSelector(current);
    if (classSelector) {
      selector += classSelector;
    }
    
    // 如果需要，添加 nth-child
    const parent = current.parentElement;
    if (parent && parent !== container) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

/**
 * 生成稳健的选择器数组
 * 按优先级排序：语义属性 > 稳定 class > 完整路径
 * @param element 目标元素
 * @returns 选择器数组（按优先级排序）
 */
export function generateRobustSelectors(element: Element): string[] {
  const selectors: string[] = [];
  
  // 1. 查找语义容器
  const container = findSemanticContainer(element);
  
  // 2. 生成基于语义属性的选择器（最高优先级）
  const attrSelector = getStableAttributeSelector(container);
  if (attrSelector) {
    if (container === element) {
      selectors.push(attrSelector);
    } else {
      // 需要相对路径
      const relativePath = generateRelativePath(container, element);
      selectors.push(`${attrSelector} ${relativePath}`);
    }
  }
  
  // 3. 生成基于稳定 class 的选择器
  const classSelector = getStableClassSelector(container);
  if (classSelector) {
    if (container === element) {
      selectors.push(classSelector);
    } else {
      const relativePath = generateRelativePath(container, element);
      selectors.push(`${classSelector} ${relativePath}`);
    }
  }
  
  // 4. 生成完整路径选择器（最低优先级，但最稳定）
  const fullPath = generateFullPath(element);
  if (!selectors.includes(fullPath)) {
    selectors.push(fullPath);
  }
  
  // 去重并返回
  return [...new Set(selectors)];
}

/**
 * 根据选择器数组查找元素
 * 按优先级尝试，返回第一个匹配的元素
 * @param selectors 选择器数组
 * @returns 找到的元素或 null
 */
export function findElementBySelectors(selectors: string[]): Element | null {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    } catch (e) {
      // 无效选择器，继续尝试下一个
      continue;
    }
  }
  return null;
}

/**
 * 基于文本内容查找元素（回退策略）
 * 优先返回最内层的、包含文本的最精确元素
 * @param text 要查找的文本
 * @param contextBefore 前文上下文
 * @param contextAfter 后文上下文
 * @returns 找到的元素或 null
 */
export function findElementByText(
  text: string,
  contextBefore?: string,
  contextAfter?: string
): Element | null {
  // 清理文本
  const cleanText = text.trim();
  if (!cleanText) return null;

  try {
    // 策略 1: 使用 TreeWalker 找到包含文本的最深层元素
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    const candidates: Element[] = [];
    let node: Text | null;

    while (node = walker.nextNode() as Text) {
      if (node.textContent && node.textContent.includes(cleanText)) {
        const parent = node.parentElement;
        if (parent) {
          candidates.push(parent);
        }
      }
    }

    // 如果没有找到，返回 null
    if (candidates.length === 0) return null;

    // 策略 2: 如果有上下文，筛选匹配上下文的元素
    let filteredCandidates = candidates;
    if ((contextBefore || contextAfter) && candidates.length > 1) {
      filteredCandidates = candidates.filter(el => {
        const parent = el.parentElement;
        if (!parent) return false;
        const parentText = parent.textContent || '';
        if (contextBefore && !parentText.includes(contextBefore)) return false;
        if (contextAfter && !parentText.includes(contextAfter)) return false;
        return true;
      });

      // 如果筛选后没有结果，使用原始列表
      if (filteredCandidates.length === 0) {
        filteredCandidates = candidates;
      }
    }

    // 策略 3: 选择最内层的元素（文本内容最接近 quote 长度的）
    // 这样可以避免选中大的容器
    let bestMatch = filteredCandidates[0];
    let bestScore = Infinity;

    for (const el of filteredCandidates) {
      const textLength = el.textContent?.length || 0;
      // 计算文本长度与 quote 长度的差异
      const lengthDiff = Math.abs(textLength - cleanText.length);
      // 计算元素深度（越深越精确）
      let depth = 0;
      let curr: Element | null = el;
      while (curr && curr !== document.body) {
        depth++;
        curr = curr.parentElement;
      }

      // 评分：长度差异越小越好，深度越深越好
      const score = lengthDiff - depth * 10;

      if (score < bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    }

    return bestMatch;
  } catch (e) {
    console.error('Text search failed:', e);
  }

  return null;
}

/**
 * 获取文本的上下文
 * @param text 目标文本
 * @param container 容器元素
 * @returns 上下文信息
 */
export function getTextContext(
  text: string,
  container: Element
): { before: string; after: string } {
  const containerText = container.textContent || '';
  const index = containerText.indexOf(text);
  
  if (index === -1) {
    return { before: '', after: '' };
  }
  
  // 获取前 20 字符
  const before = containerText.slice(Math.max(0, index - 20), index);
  
  // 获取后 20 字符
  const after = containerText.slice(index + text.length, index + text.length + 20);
  
  return { before, after };
}

/**
 * 验证选择器是否有效
 * @param selector CSS 选择器
 * @returns 是否有效
 */
export function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 生成 quote 的完整元数据
 * @param quote 引用文本
 * @param element 引用所在的元素
 * @returns 包含选择器和上下文的对象
 */
export function generateQuoteMetadata(
  quote: string,
  element: Element
): {
  selectors: string[];
  contextBefore: string;
  contextAfter: string;
} {
  const selectors = generateRobustSelectors(element);
  const { before, after } = getTextContext(quote, element);
  
  return {
    selectors,
    contextBefore: before,
    contextAfter: after,
  };
}
