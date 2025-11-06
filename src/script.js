// Settings
const round_to_min = 10;
// Globals
const APP_VERSION = "__COMMIT_HASH__";
const THEME_KEY = "tickitTheme";
const TASKS_LOG_KEY = "tickitTaskLog";
const TASK_CATEGORIES = {
    UNIVERSAL: 1,
    NETFLIX: 2,
    PARAMOUNT: 3,
    OTHER: 255
};

// Global tasks container
let tasks = [];
let active_task = -1;
let timer = null;
let task_filter = 0; // 0 is ALL

// Elements
const btn_theme_toggler = document.getElementById("themeToggle");
const btn_add_task = document.getElementById("addBtn");
const btn_reset_tasks = document.getElementById("resetBtn");
const task_name_input = document.getElementById("taskNameInput");
const el_cat_input = document.getElementById("taskCategoryInputs");
const task_filter_el = document.getElementById("taskFilter");
const task_list = document.getElementById("taskList");
const btn_summary = document.getElementById("summaryBtn");
const summary_wrapper = document.getElementById("summaryWrapper");
const summary_el = document.getElementById("summary");
const btn_copy = document.getElementById("copyBtn");
const auto_start_cb = document.getElementById("auto-start");

function debounce(fn, delay) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

function load_theme() {
    const t = localStorage.getItem(THEME_KEY) || "light";
    apply_theme(t);
}

function apply_theme(theme) {
    document.body.classList.toggle("dark", theme === "dark");
    btn_theme_toggler.innerHTML = document.body.classList.contains("dark")
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon-icon lucide-moon"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun-icon lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
}

function toggle_theme() {
    const current = localStorage.getItem(THEME_KEY) || "light";
    const next = current === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    apply_theme(next);
}

function make_id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function round_to_next_mins(ms, step_min) {
    const step = step_min * 60 * 1000;
    return Math.ceil(ms / step) * step;
}

function fmt_duration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmt_summary_duration(ms, step_min) {
    const rounded = round_to_next_mins(ms, step_min);
    const total_min = Math.floor(rounded / (60 * 1000));
    const h = Math.floor(total_min / 60);
    const m = total_min % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function toggle_note_expansion(idx) {
    tasks[idx].expanded = !tasks[idx].expanded;
    save_tasks(); // Might not necessarily have to save it here...
}

function load_tasks() {
    const raw = localStorage.getItem(TASKS_LOG_KEY);
    if (!raw) return [];
    tasks = JSON.parse(raw);
    // Quickly find the active task if any
    active_task = (tasks.find(t => t.active)?.id) ?? -1;
}

function save_tasks() {
    localStorage.setItem(TASKS_LOG_KEY, JSON.stringify(tasks));
}

function reset_tasks() {
    if (tasks.length > 0) {
        if (confirm("Delete all tasks? (this will also copy a summary of all to clipboard)")) {
            generate_summary();
            copy_summary();
            summary_el.textContent = "";
            summary_wrapper.classList.add("hidden");
            show_toast("Summary copied & all tasks cleared");
            tasks = [];
            active_task = -1;
            save_tasks();
            render_tasks();
        }
    }
}

function render_tasks() {
    task_list.innerHTML = "";

    console.log(tasks.length);
    for (let i = tasks.length - 1; i >= 0; i--) {
        let t = tasks[i];
        // Early return if filtered out
        if (task_filter > 0 && t.category != task_filter) continue;

        const total_time = t.active
            ? (t.duration || 0) + (Date.now() - t.start)
            : (t.duration || 0);

        // Main task div
        const task_div = document.createElement("div");
        task_div.id = t.id;
        task_div.className = "task" + (t.active ? " active" : "");
        task_div.dataset.idx = i;
        task_div.dataset.id = t.id;

        // Task header
        const header_div = document.createElement("div");
        header_div.className = "task-header";

        // Task title (the one that makes expansion possible)
        const title_label = document.createElement("label");
        title_label.className = "task-label";
        title_label.htmlFor = t.id + "_cb";
        title_label.title = t.name;
        const title_exp_icon = document.createElement("div");
        title_exp_icon.className = "task-title-exp-icon";
        title_exp_icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="m12 19.15l3.875-3.875q.3-.3.7-.3t.7.3t.3.713t-.3.712l-3.85 3.875q-.575.575-1.425.575t-1.425-.575L6.7 16.7q-.3-.3-.288-.712t.313-.713t.713-.3t.712.3zm0-14.3L8.15 8.7q-.3.3-.7.288t-.7-.288q-.3-.3-.312-.712t.287-.713l3.85-3.85Q11.15 2.85 12 2.85t1.425.575l3.85 3.85q.3.3.288.713t-.313.712q-.3.275-.7.288t-.7-.288z"/></svg>'
        title_label.appendChild(title_exp_icon);
        const title_span = document.createElement("span");
        title_span.className = "task-title-text";
        title_span.textContent = t.name;
        title_label.appendChild(title_span);
        header_div.appendChild(title_label);

        // Meta part
        const header_right_div = document.createElement("div");
        header_right_div.className = "task-header-right";
        header_div.appendChild(header_right_div);

        // Task time
        const time_div = document.createElement("div");
        time_div.className = "task-time";
        time_div.textContent = fmt_duration(total_time);
        header_right_div.appendChild(time_div);

        // Task controls
        const controls_div = document.createElement("div");
        controls_div.className = "task-controls";
        const start_stop_btn = document.createElement("button");
        start_stop_btn.className = "task-controls-timer-btn";
        start_stop_btn.classList.add(t.active ? "stop" : "start");
        start_stop_btn.innerHTML = t.active
            ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="M6 16V8q0-.825.588-1.412T8 6h8q.825 0 1.413.588T18 8v8q0 .825-.587 1.413T16 18H8q-.825 0-1.412-.587T6 16"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="M8 17.175V6.825q0-.425.3-.713t.7-.287q.125 0 .263.037t.262.113l8.15 5.175q.225.15.338.375t.112.475t-.112.475t-.338.375l-8.15 5.175q-.125.075-.262.113T9 18.175q-.4 0-.7-.288t-.3-.712"/></svg>';
        start_stop_btn.onclick = (e) => {
            e.stopPropagation();
            t.active ? stop_task(i) : start_task(i);
        };
        controls_div.appendChild(start_stop_btn);
        const delBtn = document.createElement("button");
        delBtn.className = "task-controls-del-btn";
        delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2zM7 6v13z"/></svg>';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            delete_task(i);
        };
        controls_div.appendChild(delBtn);
        header_right_div.appendChild(controls_div);
        task_div.appendChild(header_div);

        // Task checkbox for expansion
        const checkbox = document.createElement("input");
        checkbox.className = "task-checkbox";
        checkbox.type = "checkbox";
        checkbox.id = t.id + "_cb";
        checkbox.checked = t.expanded || false;
        task_div.appendChild(checkbox);

        // Task notes
        const notes_div = document.createElement("div");
        notes_div.className = "task-notes";
        const notes_editable = document.createElement("div");
        notes_editable.className = "task-notes-editable";
        notes_editable.contentEditable = true;
        notes_editable.textContent = t.notes || "";
        notes_div.appendChild(notes_editable);

        const meta_div = document.createElement("div");
        meta_div.className = "task-meta";
        const createdDate = new Date(t.created || Date.now());
        const timeString = createdDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const cat = Object.keys(TASK_CATEGORIES).find(k => TASK_CATEGORIES[k] === +t.category);
        const readable_cat = cat.charAt(0) + cat.slice(1).toLowerCase();
        meta_div.textContent = `Added: ${timeString} · Category: ${readable_cat}`;
        notes_div.appendChild(meta_div);

        task_div.appendChild(notes_div);
        task_list.appendChild(task_div);
    }
}

function add_task() {
    const task_name = task_name_input.value.trim();
    if (!task_name) return;
    const id = make_id();
    const category = document.querySelector("input[name=task-category]:checked").value;
    tasks.push({
        id,
        name: task_name,
        category,
        notes: "",
        duration: 0,
        active: false,
        expanded: false,
        created: Date.now(),
        start: 0,
    });
    task_name_input.value = "";
    save_tasks();
    // Auto-start if requested
    if (auto_start_cb.checked) start_task(tasks.length - 1);
}

function delete_task(task_idx) {
    if (confirm("Delete task? There is no going back.")) {
        if (tasks[task_idx].id == active_task) {
            active_task = 0;
            stop_timer();
        }
        tasks.splice(task_idx, 1);
        save_tasks();
        render_tasks();
    }
}

function start_timer() {
    if (!timer && active_task != -1) {
        timer = setInterval(() => {
            const task_idx = tasks.findIndex(t => t.id == active_task && t.active);
            if (task_idx !== -1) {
                const task = tasks[task_idx];
                const task_time_el = document.querySelector(`[data-id=${task.id}] .task-time`);
                if (task_time_el && task.start > 0) {
                    const total = (task.duration || 0) + (Date.now() - task.start);
                    task_time_el.textContent = fmt_duration(total);
                }
            }
        }, 1000);
    }
}

function stop_timer() {
    if (timer) { clearInterval(timer); timer = null; }
}

function start_task(idx) {
    // deactivate all tasks
    tasks.forEach((t, i) => { if (t.active) stop_task(i); });
    // start the task in the list
    tasks[idx].active = true;
    tasks[idx].start = Date.now();
    // Add it as active
    active_task = tasks[idx].id;
    // Save new state and rerender tasks
    save_tasks();
    render_tasks();
    // Stop & start timer
    stop_timer();
    start_timer();
}

function stop_task(idx) {
    const t = tasks[idx];
    if (!t.active) return;
    t.active = false;
    active_task = 0;
    t.duration = (t.duration || 0) + (Date.now() - t.start);
    t.start = 0;
    save_tasks();
    render_tasks(); // full rebuild once
}

function render_categories() {
    Object.entries(TASK_CATEGORIES).forEach(([key, value]) => {
        const readable_name = key.charAt(0) + key.slice(1).toLowerCase();

        // Radio buttons for adding category to task
        const radio_btn = document.createElement("input");
        radio_btn.setAttribute("type", "radio");
        radio_btn.setAttribute("name", "task-category");
        radio_btn.setAttribute("value", value);
        radio_btn.setAttribute("id", key);

        const radio_label = document.createElement("label");
        radio_label.setAttribute("for", key);
        radio_label.textContent = readable_name;

        if (el_cat_input) {
            el_cat_input.appendChild(radio_btn);
            el_cat_input.appendChild(radio_label);
        } else {
            console.error(`Parent element with ID '${el_cat_input}' not found.`);
        }

        // Select options for filtering tasks
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = readable_name;
        task_filter_el.appendChild(opt);
    });
}

function get_readable_category_name_from_id(id) {
    if (id == 0) return "All";
    const cat = Object.keys(TASK_CATEGORIES).find(k => TASK_CATEGORIES[k] === +id);
    return cat.charAt(0) + cat.slice(1).toLowerCase();
}

function generate_summary() {
    let cat_name = get_readable_category_name_from_id(task_filter);
    summary_el.textContent = "";
    summary_wrapper.classList.add("hidden");

    const today = new Date().toISOString().slice(0, 10);
    let text = `— Crossover - ${cat_name} (${today}) —\n\n`;
    let count = 0;
    tasks.forEach(t => {
        if (task_filter != 0 && t.category != task_filter) return;
        let dur = t.active
            ? (t.duration || 0) + (Date.now() - t.start)
            : (t.duration || 0);
        const notes = t.notes ? `\n${t.notes}` : "";
        // text += task_filter == 0 ? `[${get_readable_category_name_from_id(t.category)}] ` : "";
        text += `${t.name}`;
        text += `${notes}\n\n`;
        text += `Time: ${fmt_summary_duration(dur, round_to_min)}\n--\n\n`;
        count++;
    });
    if (count > 0) {
        summary_el.textContent = text;
        summary_wrapper.classList.remove("hidden");
        return text;
    }
}

function copy_summary() {
    const summary_txt = summary_el.textContent.trim();
    if (!summary_txt) return show_toast("No summary to copy.");
    navigator.clipboard.writeText(summary_txt)
        .then(() => show_toast("Summary copied!"))
        .catch(() => show_toast("Copy failed."));
}

function show_toast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

function filter_tasks(cat) {
    task_filter = +cat;
    const cat_name = get_readable_category_name_from_id(cat);
    document.querySelector(".tasks-header h2").textContent = cat_name + " Tasks";
    btn_summary.textContent = `Generate Summary for ${cat_name}`;
    // NOTE: this does not render
}

// Startup
document.addEventListener('DOMContentLoaded', function() {
    document.querySelector(".ver").textContent = `Build ${APP_VERSION}`;

    load_theme();
    load_tasks();

    // Listeners
    btn_theme_toggler.addEventListener("click", toggle_theme);
    btn_add_task.addEventListener("click", () => {
        add_task();
        filter_tasks(0);
        render_tasks();
    });
    btn_reset_tasks.addEventListener("click", reset_tasks);
    btn_summary.addEventListener("click", generate_summary);
    btn_copy.addEventListener("click", copy_summary);
    task_filter_el.addEventListener("change", e => {
        filter_tasks(+e.target.value);
        render_tasks();
    });

    task_list.addEventListener("click", e => {
        if (e.target.matches(".task-checkbox")) {
            const task_el = e.target.closest(".task");
            const idx = +task_el.dataset.idx;
            toggle_note_expansion(idx);
        }
    });

    // auto_start_cb.addEventListener("change", e => {
    //     addBtn.textContent = e.target.checked ? "Add Task & Start Timer" : "Add Task";
    // });

    // Debounced note editing
    const save_tasks_debounced = debounce(save_tasks, 400);
    task_list.addEventListener("input", e => {
        if (e.target.matches(".task-notes-editable")) {
            const task_el = e.target.closest(".task");
            const idx = +task_el.dataset.idx;
            const text = e.target.innerText.trim();
            tasks[idx].notes = text;
            save_tasks_debounced();
        }
    });

    // Making sure that pasting doesn't bring formatting with it
    task_list.addEventListener("paste", e => {
        if (e.target.matches(".task-notes-editable")) {
            e.preventDefault();
            // Always extract plain text (no formatting)
            const text = (e.clipboardData || window.clipboardData).getData("text/plain");
            // Normalize Windows/Mac line endings to \n
            const normalized = text.replace(/\r\n?/g, "\n");
            // Use Range API instead of execCommand (deprecated & buggy)
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            sel.deleteFromDocument();
            sel.getRangeAt(0).insertNode(document.createTextNode(normalized));
            // Move caret to end of inserted text
            sel.collapseToEnd();
            // save tasks just in case
            const task_el = e.target.closest(".task");
            const idx = +task_el.dataset.idx;
            const div_text = e.target.innerText.trim();
            tasks[idx].notes = div_text;
            save_tasks();
        }
    });

    // Creating category radio buttons
    render_categories();
    document.querySelector("input[name=task-category]:first-of-type").checked = true;

    // Render tasks
    render_tasks();
    // Start timer
    start_timer();
});

