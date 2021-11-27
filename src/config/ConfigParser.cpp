#include "ConfigParser.hpp"

string ConfigParser::_get_file_contents(const string &filename) {
  std::ifstream in(filename, std::ios::in | std::ios::binary);
  if (!in) {
    throw std::invalid_argument("config file " + filename + " doesn't exist");
  }
  std::ostringstream contents;
  contents << in.rdbuf();
  return contents.str();
}

bool ConfigParser::_path_valid(const fs::path &path, bool require_exist) {
  return (!path.empty()) && (!require_exist || fs::exists(path));
}

fs::path ConfigParser::_determine_path(const fs::path &original,
                                       const fs::path &workplace,
                                       const fs::path &replaced,
                                       bool require_exist) {
  if (_path_valid(original, require_exist)) {
    return original;
  } else if (_path_valid(workplace, require_exist)) {
    if (_path_valid(replaced, require_exist)) {
      return replaced;
    }
  }
  return fs::path();
}

void ConfigParser::_determine_config_path(Config &config) {
  config._config_path = _determine_path( //
      config._config_path, config._workplace_path,
      config._workplace_path / "config.yml");
}

void ConfigParser::_determine_input_paths(Config &config) {
  config._main_source_path = _determine_path( //
      config._main_source_path, config._workplace_path,
      config._workplace_path / "en" / "GregTech.lang");
  config._extra_source_path = _determine_path( //
      config._extra_source_path, config._workplace_path,
      config._workplace_path / config._lang / "GregTech.fallback.lang");
  config._main_target_path = _determine_path( //
      config._main_target_path, config._workplace_path,
      config._workplace_path / config._lang / "GregTech.lang", false);
  config._extra_target_path = _determine_path( //
      config._extra_target_path, config._workplace_path,
      config._workplace_path / config._lang / "GregTech.unknown.lang", false);
}

void ConfigParser::_parse_config_file(Config &config) {
  string config_contents = _get_file_contents(config._config_path.string());

  ryml::Tree tree = ryml::parse(ryml::to_csubstr(config_contents));
  ryml::NodeRef root = tree.rootref();

  string lang_read = _read_val(root, "lang");
  if (!lang_read.empty()) {
    config._lang = std::move(lang_read);
  }
  config._version = _read_val(root, "version");
  if (root.has_child("generators")) {
    auto node = root["generators"];
    if (node.is_seq()) {
      for (const auto &generator_node : node.children()) {
        auto node_results = parse_generator(generator_node);
        config._generators.insert(config._generators.end(),
                                  node_results.begin(), node_results.end());
      }
    } else {
      throw std::invalid_argument("invalid generator type in config");
    }
  } else {
    throw std::invalid_argument("empty generator in config");
  }

  if (config._lang.empty()) {
    config._lang = "zh";
  }
}

Config ConfigParser::parse_config(const RuntimeOptions &options) {
  Config result(options);
  _determine_config_path(result);
  _parse_config_file(result);
  _determine_input_paths(result);
  return result;
}

vector<shared_ptr<Generator>>
ConfigParser::parse_generator(const ryml::NodeRef &node) {
  auto meta = std::make_shared<GeneratorMeta>();
  vector<shared_ptr<Generator>> result;
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
          meta->extensions().insert(_read_val(ext_node));
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
        result.push_back(std::move(gen));
      } else {
        throw std::invalid_argument("invalid dict for generator");
      }
    } else if (ckey == "rules") {
      // RuleGenerator
      if (child.is_seq()) {
        auto gen = std::make_shared<RuleGenerator>(meta);
        auto &rules = gen->rules();
        for (auto rule : child.children()) {
          rules.push_back(parse_rule(rule));
        }
        result.push_back(std::move(gen));
      } else {
        throw std::invalid_argument("invalid rules for generator");
      }
    }
  }
  return result;
}

shared_ptr<Rule> ConfigParser::parse_rule(const ryml::NodeRef &node) {
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

string ConfigParser::_read_val(const ryml::NodeRef &node) {
  if (node.has_val()) {
    return _csubstr2str(node.val().unquoted());
  } else {
    throw std::invalid_argument("node has no val.");
  }
}
string ConfigParser::_read_val(const ryml::NodeRef &node, const string &key) {
  auto ckey = ryml::to_csubstr(key);
  if (node.has_child(ckey)) {
    return _read_val(node[ckey]);
  } else {
    throw std::invalid_argument("node has no child '" + key + "'.");
  }
}
bool ConfigParser::_str2bool(const string &str) {
  if (str == "true") {
    return true;
  } else if (str == "false") {
    return false;
  } else {
    throw std::invalid_argument("'" + str + "' is neither true nor false.");
  }
}
string ConfigParser::_csubstr2str(const c4::csubstr &str) {
  return string(str.str, str.len);
}
