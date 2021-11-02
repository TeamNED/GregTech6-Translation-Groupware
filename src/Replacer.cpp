#include "Replacer.hpp"

const fs::path &Replacer::main_source_path() { return this->_main_source_path; }
const fs::path &Replacer::extra_source_path() {
  return this->_extra_source_path;
}
const fs::path &Replacer::main_target_path() { return this->_main_target_path; }
const fs::path &Replacer::extra_target_path() {
  return this->_extra_target_path;
}
const fs::path &Replacer::config_path() { return this->_config_path; }
const string &Replacer::lang() { return this->_lang; }
const string &Replacer::version() { return this->_version; }
const vector<shared_ptr<Generator>> &Replacer::generators() {
  return this->_generators;
}

Replacer::Replacer(int argc, char const *argv[]) {
  // declare options
  po::options_description desc("Available options");
  desc.add_options()                                                     //
      ("workplace,w", po::value<string>(),                               //
       "workplace for language files and configs")                       //
      ("language,l", po::value<string>(), "language code")               //
      ("source,s", po::value<vector<string>>(), "source language files") //
      ("target,t", po::value<vector<string>>(),                          //
       "target language files")                                          //
      ("config,c", po::value<string>(), "config file");                  //

  // parse and store options
  po::variables_map vm;
  po::store(po::parse_command_line(argc, argv, desc), vm);
  po::notify(vm);

  // process options
  // --language lang
  if (vm.count("language")) {
    this->_lang = vm["language"].as<string>();
  } else {
    this->_lang = "zh";
  }

  // --workplace workdir
  if (vm.count("workplace")) {
    fs::path workplace(vm["workplace"].as<string>());
    this->_config_path = workplace / "config.yml";
    this->_main_source_path = workplace / "en" / "GregTech.lang";
    this->_main_target_path = workplace / this->_lang / "GregTech.lang";
    this->_extra_source_path = workplace / "en" / "GregTech.extra.lang";
    this->_extra_target_path = workplace / this->_lang / "GregTech.extra.lang";
  }

  // --config config
  if (vm.count("config")) {
    this->_config_path = vm["config"].as<string>();
  }

  // --source main extra
  if (vm.count("source")) {
    auto source_paths = vm["source"].as<vector<string>>();
    if (source_paths.size() >= 1) {
      this->_main_source_path = fs::path(source_paths[0]);
      if (source_paths.size() >= 2) {
        this->_extra_source_path = fs::path(source_paths[1]);
      }
    }
  }

  // --target main extra
  if (vm.count("target")) {
    auto target_paths = vm["target"].as<vector<string>>();
    if (target_paths.size() >= 1) {
      this->_main_target_path = fs::path(target_paths[0]);
      if (target_paths.size() >= 2) {
        this->_extra_target_path = fs::path(target_paths[1]);
      }
    }
  }

  // Config guard
  if (this->_config_path.empty()) {
    throw std::invalid_argument("config file not exist");
  }
  _parse_config();
}

Replacer::~Replacer() {}

string Replacer::_get_file_contents(const string &filename) {
  std::ifstream in(filename, std::ios::in | std::ios::binary);
  if (!in) {
    throw std::invalid_argument("config file " + filename + " doesn't exist");
  }
  std::ostringstream contents;
  contents << in.rdbuf();
  return contents.str();
}

void Replacer::_parse_config() {
  string config_contents = _get_file_contents(this->_config_path.string());
  ryml::Tree tree = ryml::parse(ryml::to_csubstr(config_contents));
  ryml::NodeRef root = tree.rootref();
  this->_lang = _read_val(root, "lang");
  this->_version = _read_val(root, "version");
  if (root.has_child("generators")) {
    auto node = root["generators"];
    if (node.is_seq()) {
      this->_generators = vector<shared_ptr<Generator>>{};
      for (const auto &generator_node : node.children()) {
        _parse_generator(generator_node);
      }
    } else {
      throw std::invalid_argument("invalid generator type in config");
    }
  } else {
    throw std::invalid_argument("empty generator in config");
  }
}

void Replacer::_parse_generator(const ryml::NodeRef &node) {
  // TODO
  auto meta = std::make_shared<GeneratorMeta>();
  for (const auto &child : node.children()) {
    auto ckey = child.key();
    if (ckey == "group") {
      meta->group() = _read_val(child);
    } else if (ckey == "namespace") {
      meta->namespace_prefix() = _read_val(child);
    } else if (ckey == "cached") {
      meta->cached() = _str2bool(_read_val(child));
    } else if (ckey == "completed") {
      meta->completed() = _str2bool(_read_val(child));
    } else if (ckey == "extension") {
      if (child.is_seq()) {
        for (const auto &ext_node : child.children()) {
          meta->extentions().insert(_read_val(ext_node));
        }
      } else {
        throw std::invalid_argument("invalid extension for generator");
      }
    } else if (ckey == "dict") {
      // DictGenerator
      if (child.is_map()) {
        auto gen = std::make_shared<DictGenerator>(meta);
        gen->dict() = std::make_shared<LangList>();
        auto &dict = *(gen->dict());
        for (auto dict_item : child.children()) {
          dict.emplace_back(_csubstr2str(dict_item.key()),
                            _csubstr2str(dict_item.val()));
        }
        this->_generators.push_back(std::move(gen));
      } else {
        throw std::invalid_argument("invalid dict for generator");
      }
    } else if (ckey == "rules") {
      // RuleGenerator
      if (child.is_seq()) {
        auto gen = std::make_shared<RuleGenerator>(meta);
        gen->repository() = this;
        auto &rules = gen->rules();
        for (auto rule : child.children()) {
          rules.push_back(_parse_rule(rule));
        }
        this->_generators.push_back(std::move(gen));
      } else {
        throw std::invalid_argument("invalid rules for generator");
      }
    }
  }
}

shared_ptr<Rule> Replacer::_parse_rule(const ryml::NodeRef &node) {
  auto rule = std::make_shared<Rule>();
  if (node.is_map()) {
    for (auto child : node.children()) {
      auto ckey = child.key();
      if (ckey == "s") {
        rule->source() = _csubstr2str(child.val());
      } else if (ckey == "t") {
        rule->target() = _csubstr2str(child.val());
      } else if (ckey == "subs") {
        if (child.is_seq()) {
          auto &subs = rule->subs();
          for (auto sub : child.children()) {
            subs.push_back(_csubstr2str(sub.val()));
          }
        } else {
          throw std::invalid_argument("invalid rule subs");
        }
      }
    }
  } else {
    throw std::invalid_argument("invalid rule");
  }
  return std::move(rule);
}

string Replacer::_read_val(const ryml::NodeRef &node) {
  if (node.has_val()) {
    return _csubstr2str(node.val().unquoted());
  } else {
    throw std::invalid_argument("node has no val.");
  }
}
string Replacer::_read_val(const ryml::NodeRef &node, const string &key) {
  auto ckey = ryml::to_csubstr(key);
  if (node.has_child(ckey)) {
    return _read_val(node[ckey]);
  } else {
    throw std::invalid_argument("node has no child '" + key + "'.");
  }
}

bool Replacer::_str2bool(const string &str) {
  if (str == "true") {
    return true;
  } else if (str == "false") {
    return false;
  } else {
    throw std::invalid_argument("'" + str + "' is neither true nor false.");
  }
}
string Replacer::_csubstr2str(const c4::csubstr &str) {
  return string(str.str, str.len);
}

vector<shared_ptr<ILangResult>> Replacer::generate() {
  _result_cache.clear();
  _group_cache.clear();
  vector<shared_ptr<ILangResult>> results;
  for (auto gen : _generators) {
    if (gen->meta()->completed()) {
      auto new_results = _get_generator_results(gen);
      results.insert(results.end(), new_results.begin(), new_results.end());
    }
  }
  return results;
}

map<string, vector<std::pair<string, string>>> Replacer::generate_map() {
  map<string, vector<std::pair<string, string>>> result;
  auto lang_list = generate();
  for (auto lang : lang_list) {
    auto lang_generated = lang->result();
    for (auto lang_item : *lang_generated) {
      const string &src = lang_item.first;
      const string &dst = lang_item.second;
      const string &ns = lang->meta()->namespace_prefix();
      result[src].emplace_back(ns, dst);
    }
  }
  return result;
}

vector<shared_ptr<ILangResult>>
Replacer::_get_generator_results(shared_ptr<Generator> gen) {
  auto rcache_found = _result_cache.find(gen);
  if (rcache_found == _result_cache.end()) {
    // new result
    auto new_results = gen->results();
    _result_cache[gen] = new_results;
    return new_results;
  } else {
    // old result
    return rcache_found->second;
  }
}

vector<shared_ptr<ILangResult>>
Replacer::get_group_results(const string &group) {
  auto gcache_found = _group_cache.find(group);
  if (gcache_found == _group_cache.end()) {
    // new group
    vector<shared_ptr<ILangResult>> results;
    for (auto gen : _generators) {
      if (gen->meta()->group() == group) {
        auto new_results = _get_generator_results(gen);
        results.insert(results.end(), new_results.begin(), new_results.end());
      }
    }
    return results;
  } else {
    // old group
    return gcache_found->second;
  }
}