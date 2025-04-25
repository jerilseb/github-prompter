/**
 * Deep clones an object using JSON methods.
 * Note: This method has limitations (e.g., loses functions, Date objects become strings).
 * Functionality remains as in the original.
 * @param {object} obj - The object to clone.
 * @returns {object} The deeply cloned object.
 */
function deepClone(obj) {
  // Functionality kept identical as requested.
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Returns a new array with unique primitive values from the input array.
 * @param {Array<any>} arr - The input array.
 * @returns {Array<any>} A new array with unique values.
 */
const uniq = (arr) => [...new Set(arr)];

/**
 * Removes all child nodes from a DOM element.
 * @param {Element} ele - The DOM element to empty.
 */
function empty(ele) {
  while (ele.firstChild) {
    ele.removeChild(ele.firstChild);
  }
}

/**
 * Performs a simple animation using requestAnimationFrame and setTimeout.
 * @param {number} duration - The duration of the animation's active phase.
 * @param {{enter: function, active: function, leave: function}} callback - Object with enter, active, and leave callbacks.
 */
function animation(duration, callback) {
  requestAnimationFrame(() => {
    callback.enter();
    requestAnimationFrame(() => {
      callback.active();
      setTimeout(() => {
        callback.leave();
      }, duration);
    });
  });
}

/**
 * Recursively collapses parent nodes starting from a leaf node.
 * @param {Tree} tree - The Tree instance.
 * @param {object} leafNode - The starting leaf node object.
 */
function collapseFromLeaf(tree, leafNode) {
  // Use optional chaining for safer access
  const parentNode = leafNode?.parent;
  if (!parentNode) {
    return;
  }

  try {
    const nodeLiElement = tree.liElementsById[parentNode.id];
    // Check if element exists and is not already closed
    if (nodeLiElement && !nodeLiElement.classList.contains('treejs-node__close')) {
      // Use optional chaining for switcher element as well
      nodeLiElement.querySelector('.treejs-switcher')?.click();
    }
  } catch (error) {
    // It's generally better to log or handle specific errors
    console.error("Error during collapse:", error);
    return; // Exit if an error occurs accessing DOM elements
  }

  // Recurse if the parent node itself has a parent
  if (parentNode.parent) {
    collapseFromLeaf(tree, parentNode);
  }
}


/**
 * Recursively expands nodes starting from a given root node.
 * @param {Tree} tree - The Tree instance.
 * @param {object} node - The starting node object.
 */
function expandFromRoot(tree, node) {
  if (!node) return; // Guard clause if node is null/undefined

  const nodeLiElement = tree.liElementsById[node.id];
  if (nodeLiElement && nodeLiElement.classList.contains('treejs-node__close')) {
    nodeLiElement.querySelector('.treejs-switcher')?.click();
  }

  // Use optional chaining for children access
  if (node.children?.length) {
    for (const child of node.children) {
      expandFromRoot(tree, child);
    }
  }
}


class Tree {
  // Default options as a static property or defined within constructor
  static defaultOptions = {
    values: [],
    closeDepth: null, // e.g., 1 means collapse level 1 and deeper
    onChange: null,   // Added onChange based on its usage
    data: []          // Added data based on its usage
  };

  treeNodes = [];
  nodesById = {};
  leafNodesById = {};
  liElementsById = {};
  willUpdateNodesById = {}; // Nodes queued for DOM update
  containerElement = null; // Store the actual element, not just selector

  constructor(containerSelector, options = {}) {
    const containerElement = document.querySelector(containerSelector);
    if (!containerElement) {
      throw new Error(`Tree container element not found: ${containerSelector}`);
    }
    this.containerElement = containerElement;

    // Merge options using spread syntax
    this.options = { ...Tree.defaultOptions, ...options };

    // Initialize the tree
    this.init(this.options.data);
  }

  // --- Getters and Setters ---

  get values() {
    // Filter leaf nodes that are checked (status 1 or 2)
    return Object.values(this.leafNodesById)
      .filter(node => node.status === 1 || node.status === 2)
      .map(node => node.id);
  }

  set values(newValues) {
    // Ensure unique values
    const uniqueValues = uniq(newValues);
    this.emptyNodesCheckStatus(); // Reset status of currently selected nodes
    uniqueValues.forEach(value => this.setValue(value, false)); // Set new values without triggering update yet
    this.updateLiElements(); // Update DOM for all changed nodes at once
    this.options.onChange?.call(this); // Trigger onChange callback if defined
  }

  get selectedNodes() {
    // Filter all nodes that are checked or half-checked
    return Object.values(this.nodesById)
      .filter(node => node.status === 1 || node.status === 2)
      .map(node => {
        // Return a clean copy without circular references
        const { parent, children, ...nodeInfo } = node;
        return nodeInfo;
      });
  }

  // --- Initialization and Rendering ---

  init(data) {
    console.time('init');

    // Parse data using the static method
    const {
      treeNodes,
      nodesById,
      leafNodesById,
      defaultValues,
    } = Tree.parseTreeData(data || []); // Use empty array if data is null/undefined

    this.treeNodes = treeNodes;
    this.nodesById = nodesById;
    this.leafNodesById = leafNodesById;
    this.liElementsById = {}; // Reset DOM element map

    this.render(this.treeNodes); // Render the tree structure

    // Apply initial values (prioritize options over data attributes)
    const initialValues = this.options.values?.length ? this.options.values : defaultValues;
    if (initialValues.length) {
      this.values = initialValues; // Use the setter
    }

    console.timeEnd('init');
  }

  render(treeNodes) {
    const treeEle = Tree.createRootEle();
    // Build the tree structure recursively
    const rootUl = this.buildTree(treeNodes, 0);
    if (rootUl) {
      treeEle.appendChild(rootUl);
    }

    this.bindEvent(treeEle); // Bind events to the root element

    empty(this.containerElement); // Clear the container
    this.containerElement.appendChild(treeEle); // Add the new tree
  }

  buildTree(nodes, depth) {
    if (!nodes?.length) {
      return null; // Return null if no nodes to render
    }

    const ulEle = Tree.createUlEle();
    nodes.forEach(node => {
      // Determine if node should be initially closed based on depth
      const isClosed = typeof this.options.closeDepth === 'number' && depth >= this.options.closeDepth;
      const liEle = Tree.createLiEle(node, isClosed);
      this.liElementsById[node.id] = liEle; // Store reference to the LI element

      // Recursively build child nodes if they exist
      if (node.children?.length) {
        const childUl = this.buildTree(node.children, depth + 1);
        if (childUl) {
          liEle.appendChild(childUl); // Append children UL only if it's not null
        }
      }
      ulEle.appendChild(liEle);
    });
    return ulEle;
  }

  // --- Event Handling ---

  bindEvent(treeElement) {
    // Use event delegation on the root element
    treeElement.addEventListener('click', (event) => {
      const { target } = event;
      const liElement = target.closest('.treejs-node'); // Find the parent LI node

      if (!liElement) return; // Click didn't happen within a node

      const nodeId = liElement.nodeId;
      if (!nodeId) return; // Should not happen if structure is correct

      // Handle switcher click (expand/collapse)
      if (target.classList.contains('treejs-switcher')) {
        this.onSwitcherClick(target, liElement);
      }
      // Handle checkbox or label click (select/deselect)
      else if (target.classList.contains('treejs-checkbox') || target.classList.contains('treejs-label')) {
        this.onItemClick(nodeId);
      }
      // Optional: Handle click directly on LI (could also trigger selection)
      // else if (target === liElement) {
      //    this.onItemClick(nodeId);
      // }
    });
  }

  onItemClick(id) {
    const node = this.nodesById[id];
    if (!node) {
      return; // Do nothing if node doesn't exist
    }

    // Use the public setter which handles propagation and updates
    this.setValue(id); // This now triggers updates internally

    // Call the onChange callback if provided
    this.options.onChange?.call(this);
  }

  onSwitcherClick(switcherElement, liElement) {
    const childUl = liElement.querySelector(':scope > .treejs-nodes'); // Get direct child UL
    if (!childUl) return; // No children to expand/collapse

    const isClosing = !liElement.classList.contains('treejs-node__close');
    const height = childUl.scrollHeight; // Get natural height

    if (isClosing) {
      // Closing animation
      animation(150, {
        enter: () => {
          childUl.style.height = `${height}px`;
          childUl.style.opacity = '1';
        },
        active: () => {
          childUl.style.height = '0';
          childUl.style.opacity = '0';
        },
        leave: () => {
          childUl.style.height = '';
          childUl.style.opacity = '';
          liElement.classList.add('treejs-node__close');
        },
      });
    } else {
      // Opening animation
      liElement.classList.remove('treejs-node__close'); // Remove class first to allow height calculation
      animation(150, {
        enter: () => {
          childUl.style.height = '0';
          childUl.style.opacity = '0';
        },
        active: () => {
          childUl.style.height = `${height}px`;
          childUl.style.opacity = '1';
        },
        leave: () => {
          childUl.style.height = '';
          childUl.style.opacity = '';
          // Class already removed
        },
      });
    }
  }


  // --- State Management ---

  /**
   * Sets the checked status of a single node and propagates changes.
   * @param {string|number} value - The ID of the node to set.
   * @param {boolean} [updateDOM=true] - Whether to immediately trigger DOM updates.
   */
  setValue(value, updateDOM = true) {
    const node = this.nodesById[value];
    if (!node) return; // Ignore if node not found

    // Determine the new status: 0 (unchecked) if currently checked/half-checked, 2 (checked) otherwise
    const newStatus = (node.status === 1 || node.status === 2) ? 0 : 2;

    if (node.status !== newStatus) {
      node.status = newStatus;
      this.markWillUpdateNode(node); // Mark this node for DOM update
      this.walkUp(node, 'status');   // Propagate status change upwards
      this.walkDown(node, 'status'); // Propagate status change downwards
    }

    if (updateDOM) {
      this.updateLiElements(); // Apply all queued DOM updates
    }
  }

  // --- State Resetting ---

  emptyNodesCheckStatus() {
    // Get IDs of currently selected/half-selected nodes
    const selectedIds = Object.keys(this.getSelectedNodesById());
    selectedIds.forEach(id => {
      const node = this.nodesById[id];
      if (node && node.status !== 0) {
        node.status = 0;
        this.markWillUpdateNode(node);
        // We need to walk up from *each* reset node to potentially reset parent states too
        this.walkUp(node, 'status');
      }
    });
    // Note: No immediate DOM update here, it happens after setting new values.
  }

  // --- Internal Helpers ---

  getSelectedNodesById() {
    // Helper to get a map of nodes with status 1 or 2
    const selected = {};
    for (const id in this.nodesById) {
      const node = this.nodesById[id];
      if (node.status === 1 || node.status === 2) {
        selected[id] = node;
      }
    }
    return selected;
  }


  markWillUpdateNode(node) {
    this.willUpdateNodesById[node.id] = node;
  }

  updateLiElements() {
    // Process all nodes marked for update
    Object.values(this.willUpdateNodesById).forEach(node => {
      this.updateLiElement(node);
    });
    this.willUpdateNodesById = {}; // Clear the update queue
  }

  updateLiElement(node) {
    const liElement = this.liElementsById[node.id];
    if (!liElement) return; // Should not happen normally

    const { classList } = liElement;

    // Update check status classes
    classList.remove('treejs-node__halfchecked', 'treejs-node__checked');
    if (node.status === 1) {
      classList.add('treejs-node__halfchecked');
    } else if (node.status === 2) {
      classList.add('treejs-node__checked');
    }
  }

  // --- Propagation Logic ---

  walkUp(node, changeState) {
    // Stop if there's no parent
    if (!node?.parent) {
      return;
    }
    const parent = node.parent;

    let needsUpdate = false; // Flag to check if parent state actually changed

    if (changeState === 'status') {
      // Calculate parent status based on children
      let newStatus = 0; // Default to unchecked
      let checkedCount = 0;
      let halfCheckedCount = 0;
      const allChildren = parent.children;

      if (allChildren.length > 0) {
        allChildren.forEach(child => {
          if (child.status === 2) checkedCount++;
          else if (child.status === 1) halfCheckedCount++;
        });

        if (checkedCount === allChildren.length) {
          newStatus = 2; // All children checked
        } else if (checkedCount > 0 || halfCheckedCount > 0) {
          newStatus = 1; // Some checked or half-checked
        } else {
          newStatus = 0; // All children unchecked
        }
      } else {
        newStatus = 0;
      }


      // Update parent only if status changed
      if (parent.status !== newStatus) {
        parent.status = newStatus;
        needsUpdate = true;
      }
    }

    // If the parent's state changed, mark it for update and continue walking up
    if (needsUpdate) {
      this.markWillUpdateNode(parent);
      this.walkUp(parent, changeState); // Recursive call
    }
  }

  walkDown(node, changeState) {
    // Stop if node has no children
    if (!node?.children?.length) {
      return;
    }

    node.children.forEach(child => {
      // Propagate the state change
      if (child[changeState] !== node[changeState]) {
        child[changeState] = node[changeState];
        this.markWillUpdateNode(child);
        this.walkDown(child, changeState); // Recursive call
      }
    });
  }

  // --- Public API Methods ---

  collapseAll() {
    // Iterate through leaf nodes and collapse their parents upwards
    Object.values(this.leafNodesById).forEach(leafNode => {
      collapseFromLeaf(this, leafNode);
    });
  }

  expandAll() {
    // Start expansion from each top-level root node
    this.treeNodes.forEach(rootNode => {
      expandFromRoot(this, rootNode);
    });
  }

  // --- Static Methods ---

  /**
   * Parses the raw tree data into internal node structures.
   * @param {Array<object>} data - The raw tree data array.
   * @returns {{treeNodes: Array, nodesById: object, leafNodesById: object, defaultValues: Array}}
   */
  static parseTreeData(data) {
    const treeNodes = deepClone(data); // Deep clone to avoid modifying original data
    const nodesById = {};
    const leafNodesById = {};
    const defaultValues = [];


    // Recursive function to process nodes
    const walkTree = (nodes, parent = null) => {
      nodes.forEach(node => {
        if (!node.id) {
          console.warn('Node missing required "id" property:', node);
          node.id = `treejs-node-${Math.random().toString(36).substr(2, 9)}`; // Assign a random ID if missing
        }

        // Initialize default properties if missing
        node.status = node.status ?? 0; // 0: unchecked, 1: half-checked, 2: checked
        node.checked = node.checked ?? false; // Keep original checked for initial values

        nodesById[node.id] = node; // Map node by ID

        if (node.checked) defaultValues.push(node.id);

        if (parent) {
          node.parent = parent; // Set parent reference
        }

        // Recurse for children
        if (node.children?.length) {
          walkTree(node.children, node); // Pass current node as parent
        } else {
          leafNodesById[node.id] = node; // Mark as leaf node
        }
      });
    };

    walkTree(treeNodes); // Start walking from the root nodes

    // After walking, perform initial status propagation based on default checked states
    // This ensures parent nodes reflect the initial state of their children.
    Object.values(nodesById).forEach(node => {
      if (node.checked) { // If initially checked
        // Temporarily set status to 2 to trigger walkUp correctly
        const initialStatus = node.status; // Store original status if needed elsewhere
        node.status = 2;
        // Create a temporary Tree-like object for walkUp context if needed,
        // or adjust walkUp to work standalone with nodesById.
        // For simplicity here, we assume initial propagation might be handled
        // by the setValues call in init() after parsing.
        // Let's reset status back if we don't handle propagation here.
        node.status = initialStatus; // Reset back, rely on setValues
      }
    });


    return {
      treeNodes,
      nodesById,
      leafNodesById,
      defaultValues: uniq(defaultValues), // Ensure unique default values
    };
  }

  /**
   * Creates the main container div for the tree.
   * @returns {HTMLDivElement} The root div element.
   */
  static createRootEle() {
    const div = document.createElement('div');
    div.classList.add('treejs');
    return div;
  }

  /**
   * Creates a UL element for holding tree nodes.
   * @returns {HTMLUListElement} The UL element.
   */
  static createUlEle() {
    const ul = document.createElement('ul');
    ul.classList.add('treejs-nodes');
    // Accessibility: Consider adding role="group" or "tree" depending on structure
    // ul.setAttribute('role', 'group');
    return ul;
  }

  /**
   * Creates an LI element representing a single tree node.
   * @param {object} node - The node data object.
   * @param {boolean} closed - Whether the node should be initially closed.
   * @returns {HTMLLIElement} The LI element.
   */
  static createLiEle(node, closed) {
    const li = document.createElement('li');
    li.classList.add('treejs-node');
    if (closed) {
      li.classList.add('treejs-node__close');
    }
    // Accessibility: role="treeitem"
    li.setAttribute('role', 'treeitem');
    // Set aria-expanded state for nodes with children
    if (node.children?.length) {
      li.setAttribute('aria-expanded', String(!closed));
    }

    // Add switcher span if node has children
    if (node.children?.length) {
      const switcher = document.createElement('span');
      switcher.classList.add('treejs-switcher');
      // Accessibility: Add aria-hidden maybe? Or handle via button semantics if interactive.
      li.appendChild(switcher);
    } else {
      // Add placeholder for alignment if node has no children
      li.classList.add('treejs-leaf-node'); // Add class for styling leaves
      const placeholder = document.createElement('span');
      placeholder.classList.add('treejs-placeholder'); // Use placeholder class
      li.appendChild(placeholder);
    }

    if (node.ignored) {
      li.classList.add('treejs-node__ignored');
    }

    // Add checkbox span
    const checkbox = document.createElement('span');
    checkbox.classList.add('treejs-checkbox');
    // Accessibility: Maybe link this with label via aria-labelledby if label has id
    li.appendChild(checkbox);

    // Add label span
    const label = document.createElement('span');
    label.classList.add('treejs-label');
    label.textContent = node.text ?? ''; // Use textContent for security, handle missing text
    li.appendChild(label);

    // Store node ID directly on the element for easy retrieval
    li.nodeId = node.id;

    return li;
  }
}