#include "ReplacerConfig.hpp"

ReplacerConfig::ReplacerConfig(int argc, char const *argv[]) {
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

ReplacerConfig::~ReplacerConfig() {}

string ReplacerConfig::_get_file_contents(const string &filename) {
  std::ifstream in(filename, std::ios::in | std::ios::binary);
  if (!in) {
    throw std::invalid_argument("config file " + filename + " doesn't exist");
  }
  std::ostringstream contents;
  contents << in.rdbuf();
  return contents.str();
}

void ReplacerConfig::_parse_config() {
  string config_contents = _get_file_contents(this->_config_path.string());
  ryml::Tree tree = ryml::parse(ryml::to_csubstr(config_contents));
  ryml::NodeRef root = tree.rootref();
  this->_lang = _read_val(root, "lang");
  this->_version = _read_val(root, "version");
  if (root.has_child("generators")) {
    auto node = root["generators"];
    if (node.is_seq()) {
      this->_generators = vector<Generator>{};
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

void ReplacerConfig::_parse_generator(const ryml::NodeRef &node) {
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
          meta->extentions().emplace_back(_read_val(ext_node));
        }
      } else {
        throw std::invalid_argument("invalid extension for generator");
      }
    } else if (ckey == "dict") {
      // DictGenerator
      auto gen = DictGenerator(meta);
      if (child.is_map()) {
        for (auto dict_item : child.children()) {
          gen.dict().insert(
              {_csubstr2str(dict_item.key()), _csubstr2str(dict_item.val())});
        }
        this->_generators.emplace_back(std::move(gen));
      } else {
        throw std::invalid_argument("invalid dict for generator");
      }
    }
  }
}

string ReplacerConfig::_read_val(const ryml::NodeRef &node) {
  if (node.has_val()) {
    return _csubstr2str(node.val().unquoted());
  } else {
    throw std::invalid_argument("node has no val.");
  }
}
string ReplacerConfig::_read_val(const ryml::NodeRef &node, const string &key) {
  auto ckey = ryml::to_csubstr(key);
  if (node.has_child(ckey)) {
    return _read_val(node[ckey]);
  } else {
    throw std::invalid_argument("node has no child '" + key + "'.");
  }
}

bool ReplacerConfig::_str2bool(const string &str) {
  if (str == "true") {
    return true;
  } else if (str == "false") {
    return false;
  } else {
    throw std::invalid_argument("'" + str + "' is neither true nor false.");
  }
}
string ReplacerConfig::_csubstr2str(const c4::csubstr &str) {
  return string(str.str, str.len);
}

const fs::path &ReplacerConfig::main_source_path() {
  return this->_main_source_path;
}
const fs::path &ReplacerConfig::extra_source_path() {
  return this->_extra_source_path;
}
const fs::path &ReplacerConfig::main_target_path() {
  return this->_main_target_path;
}
const fs::path &ReplacerConfig::extra_target_path() {
  return this->_extra_target_path;
}
const fs::path &ReplacerConfig::config_path() { return this->_config_path; }
const string &ReplacerConfig::lang() { return this->_lang; }
const string &ReplacerConfig::version() { return this->_version; }
const vector<Generator> &ReplacerConfig::generators() {
  return this->_generators;
}